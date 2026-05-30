/* ========================================
   EdSpire Quiz Engine — quiz.js
   Два режима: practice (обучающий) и test (проверочный).
   Типы вопросов: multiple-choice, checkbox, fill-gaps, drag-drop, dropdown, drag-words, image-pairing.
   Без зависимостей, ванильный JS.
   ======================================== */

(function () {
  'use strict';

  /* ---- Утилиты ---- */
  function ce(tag, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  function isTouchDevice() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  /* ==========================================
     ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ КВИЗА
     ========================================== */
  function initQuiz(container) {
    /* -- Читаем конфиг (script-тег или dataset для сброса) -- */
    let config;
    if (container.dataset.edqConfig) {
      try { config = JSON.parse(container.dataset.edqConfig); }
      catch (e) { console.error('EdSpire Quiz: ошибка парсинга конфига', e); return; }
    } else {
      const scriptTag = container.querySelector('script[type="application/json"]');
      if (!scriptTag) return;
      try { config = JSON.parse(scriptTag.textContent); }
      catch (e) { console.error('EdSpire Quiz: невалидный JSON', e); return; }
      container.dataset.edqConfig = scriptTag.textContent;
    }

    const mode = config.mode || 'practice';
    const questions = config.questions || [];
    if (!questions.length) return;

    /* -- Состояние -- */
    let currentIdx = 0;
    // firstAttempt[i]: null | true | false — для счёта
    const firstAttempt = questions.map(() => null);

    /* -- Очищаем контейнер, строим UI -- */
    container.innerHTML = '';
    container.dataset.mode = mode;

    /* -- Заголовок «время практики» + текст задания -- */
    const headEl = ce('p', 'edq-heading');
    headEl.textContent = 'время практики';
    container.appendChild(headEl);
    if (config.title) {
      const introEl = ce('p', 'edq-intro');
      introEl.textContent = config.title;
      container.appendChild(introEl);
    }

    /* -- Прогресс-индикатор -- */
    let dotsEl = null;
    let progressCurEl = null;

    if (mode === 'practice' && questions.length > 1) {
      dotsEl = ce('div', 'edq-dots');
      questions.forEach((_, i) => {
        const d = ce('span', 'edq-dot' + (i === 0 ? ' edq-dot--active' : ''));
        dotsEl.appendChild(d);
      });
      container.appendChild(dotsEl);
    }

    if (mode === 'test') {
      const progressEl = ce('div', 'edq-progress-text');
      progressEl.innerHTML = `Вопрос <span class="edq-prog-cur">1</span> из ${questions.length}`;
      progressCurEl = progressEl.querySelector('.edq-prog-cur');
      container.appendChild(progressEl);
    }

    /* -- Рендерим все вопросы (скрытые) -- */
    const questionEls = questions.map((q, i) => {
      const qEl = buildQuestion(q, i);
      container.appendChild(qEl);
      return qEl;
    });

    /* -- Финальный экран (test mode) -- */
    const resultEl = ce('div', 'edq-result');
    resultEl.style.display = 'none';
    container.appendChild(resultEl);

    /* -- Показываем первый вопрос -- */
    showQuestion(0);

    /* ==========================================
       ПОСТРОЕНИЕ ВОПРОСА
       ========================================== */
    function buildQuestion(q, idx) {
      const qEl = ce('div', 'edq-question');
      qEl.style.display = 'none';

      const textEl = ce('p', 'edq-question-text');
      // innerHTML разрешён: автор пишет тексты, HTML для формул (<span class="formula">)
      textEl.innerHTML = q.text;
      qEl.appendChild(textEl);

      /* Тело по типу */
      switch (q.type) {
        case 'multiple-choice': buildOptions(qEl, q, idx, false);   break;
        case 'checkbox':        buildOptions(qEl, q, idx, true);   break;
        case 'fill-gaps':       buildFillGaps(qEl, q, idx);         break;
        case 'drag-drop':       buildDragDrop(qEl, q, idx);         break;
        case 'dropdown':        buildDropdown(qEl, q, idx);         break;
        case 'drag-words':      buildDragWords(qEl, q, idx);        break;
        case 'image-pairing':   buildImagePairing(qEl, q, idx);     break;
      }

      /* Блок общего фидбека вопроса */
      const fbEl = ce('div', 'edq-feedback');
      fbEl.style.display = 'none';
      qEl.appendChild(fbEl);

      /* Кнопки действий */
      qEl.appendChild(buildActions(q, idx));

      return qEl;
    }

    /* ---- Варианты ответов (MC и checkbox) ---- */
    function buildOptions(qEl, q, idx, isCheckbox) {
      const listEl = ce('ul', 'edq-options');

      q.options.forEach((opt, oi) => {
        const li = ce('li', 'edq-option' + (isCheckbox ? ' edq-option--checkbox' : ''));
        li.dataset.oi = oi;

        const label = ce('label', 'edq-option-label');
        const input = document.createElement('input');
        input.type = isCheckbox ? 'checkbox' : 'radio';
        input.name = `edq-q${idx}`;
        input.value = oi;

        const mark = ce('span', 'edq-option-mark');
        const text = ce('span', 'edq-option-text');
        text.innerHTML = opt.text;

        label.appendChild(input);
        label.appendChild(mark);
        label.appendChild(text);
        li.appendChild(label);

        if (opt.feedback) {
          const ofb = ce('div', 'edq-option-feedback');
          ofb.innerHTML = opt.feedback;
          ofb.style.display = 'none';
          li.appendChild(ofb);
        }

        input.addEventListener('change', () => {
          if (!isCheckbox) {
            listEl.querySelectorAll('.edq-option').forEach(o => o.classList.remove('edq-option--selected'));
          }
          li.classList.toggle('edq-option--selected', input.checked);
          syncCheckBtn(qEl, q, idx);
        });

        listEl.appendChild(li);
      });

      qEl.appendChild(listEl);
    }

    /* ---- Fill in the Gaps ---- */
    function buildFillGaps(qEl, q, idx) {
      const container = ce('div', 'edq-gaps-text');

      /* Заменяем {{gapId}} на <input> обёртки */
      let html = q.text;
      Object.keys(q.gaps).forEach(gapId => {
        const gap = q.gaps[gapId];
        const size = gap.size || 10;
        html = html.replace(
          `{{${gapId}}}`,
          `<span class="edq-gap-wrap" data-gap-id="${gapId}">` +
          `<input class="edq-gap" type="text" data-gap-id="${gapId}" ` +
          `size="${size}" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="…" />` +
          `<span class="edq-gap-answer" style="display:none"></span>` +
          (gap.feedback ? `<span class="edq-gap-feedback" style="display:none"></span>` : '') +
          `</span>`
        );
      });
      container.innerHTML = html;

      /* Синхронизируем кнопку проверки */
      container.querySelectorAll('.edq-gap').forEach(input => {
        input.addEventListener('input', () => syncCheckBtn(qEl, q, idx));
      });

      qEl.appendChild(container);
    }

    /* ---- Drag & Drop ---- */
    function buildDragDrop(qEl, q, idx) {
      /* Пул карточек (перемешиваем) */
      const pool = ce('div', 'edq-drag-pool');
      [...q.items].sort(() => Math.random() - 0.5).forEach(item => {
        const chip = ce('div', 'edq-drag-item');
        chip.dataset.itemId = item.id;
        chip.innerHTML = item.text;
        pool.appendChild(chip);
      });

      /* Зоны */
      const zonesEl = ce('div', 'edq-zones');
      q.zones.forEach(zone => {
        const zEl = ce('div', 'edq-drop-zone');
        zEl.dataset.zoneId = zone.id;

        const labelEl = ce('div', 'edq-zone-label');
        labelEl.innerHTML = zone.label;
        zEl.appendChild(labelEl);

        zEl.appendChild(ce('div', 'edq-zone-items'));

        if (zone.feedback) {
          const zfb = ce('div', 'edq-zone-feedback');
          zfb.innerHTML = zone.feedback;
          zfb.style.display = 'none';
          zEl.appendChild(zfb);
        }

        zonesEl.appendChild(zEl);
      });

      qEl.appendChild(pool);
      qEl.appendChild(zonesEl);

      /* Функция проверки «все размещены» */
      function checkAllPlaced() {
        const remaining = pool.querySelectorAll('.edq-drag-item').length;
        syncCheckBtn(qEl, q, idx);
        if (mode === 'test') {
          const nextBtn = qEl.querySelector('.edq-btn--next');
          if (nextBtn) nextBtn.disabled = remaining > 0;
        }
      }

      if (isTouchDevice()) {
        setupMobileDrag(qEl, pool, zonesEl, checkAllPlaced);
      } else {
        setupDesktopDrag(qEl, pool, zonesEl, checkAllPlaced);
      }
    }

    /* ---- Desktop Drag & Drop ---- */
    function setupDesktopDrag(qEl, pool, zonesEl, onMove) {
      let dragged = null;

      function attachItemEvents(chip) {
        chip.setAttribute('draggable', 'true');
        chip.addEventListener('dragstart', e => {
          dragged = chip;
          chip.classList.add('edq-drag-item--dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        chip.addEventListener('dragend', () => {
          chip.classList.remove('edq-drag-item--dragging');
          dragged = null;
        });
      }

      pool.querySelectorAll('.edq-drag-item').forEach(attachItemEvents);

      function attachZoneEvents(zEl) {
        zEl.addEventListener('dragover', e => {
          e.preventDefault();
          zEl.classList.add('edq-drop-zone--over');
        });
        zEl.addEventListener('dragleave', e => {
          if (!zEl.contains(e.relatedTarget)) zEl.classList.remove('edq-drop-zone--over');
        });
        zEl.addEventListener('drop', e => {
          e.preventDefault();
          zEl.classList.remove('edq-drop-zone--over');
          if (!dragged) return;
          zEl.querySelector('.edq-zone-items').appendChild(dragged);
          onMove();
        });
      }

      zonesEl.querySelectorAll('.edq-drop-zone').forEach(attachZoneEvents);

      /* Пул принимает возврат */
      pool.addEventListener('dragover', e => e.preventDefault());
      pool.addEventListener('drop', e => {
        e.preventDefault();
        if (dragged) { pool.appendChild(dragged); onMove(); }
      });

      /* Сохраняем attachItemEvents для retry */
      qEl._attachDragItem = attachItemEvents;
    }

    /* ---- Mobile Tap Drag & Drop ---- */
    function setupMobileDrag(qEl, pool, zonesEl, onMove) {
      let selected = null;

      qEl.addEventListener('click', e => {
        const chip = e.target.closest('.edq-drag-item');
        const zone = e.target.closest('.edq-drop-zone');
        const inPool = e.target.closest('.edq-drag-pool');

        if (chip) {
          /* Тап на карточку */
          if (selected === chip) {
            chip.classList.remove('edq-drag-item--selected');
            selected = null;
          } else {
            if (selected) selected.classList.remove('edq-drag-item--selected');
            selected = chip;
            chip.classList.add('edq-drag-item--selected');
          }
          return;
        }

        if (!selected) return;

        if (zone) {
          /* Тап на зону — перемещаем карточку туда */
          zone.querySelector('.edq-zone-items').appendChild(selected);
          selected.classList.remove('edq-drag-item--selected');
          selected = null;
          onMove();
        } else if (inPool) {
          /* Тап на пул — возвращаем карточку */
          pool.appendChild(selected);
          selected.classList.remove('edq-drag-item--selected');
          selected = null;
          onMove();
        }
      });
    }

    /* ---- Dropdown Match ---- */
    function buildDropdown(qEl, q, idx) {
      const listEl = ce('ul', 'edq-dropdown-list');

      q.items.forEach(item => {
        const row = ce('li', 'edq-dropdown-row');
        row.dataset.answer = item.answer;

        const labelEl = ce('span', 'edq-dropdown-item');
        labelEl.textContent = item.text;

        const ctrlEl = ce('div', 'edq-dropdown-controls');

        const sel = document.createElement('select');
        sel.className = 'edq-select';

        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = 'выбери';
        sel.appendChild(ph);

        q.options.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          sel.appendChild(o);
        });

        const hint = ce('span', 'edq-dropdown-hint');
        hint.style.display = 'none';

        sel.addEventListener('change', () => syncCheckBtn(qEl, q, idx));

        ctrlEl.appendChild(sel);
        ctrlEl.appendChild(hint);
        row.appendChild(labelEl);
        row.appendChild(ctrlEl);

        listEl.appendChild(row);
      });

      qEl.appendChild(listEl);
    }

    /* ---- Drag the Words ---- */
    function buildDragWords(qEl, q, idx) {
      /* Извлекаем слова из *звёздочек*, строим HTML со слотами */
      const words = [];
      const html = q.text.replace(/\*([^*]+)\*/g, (_, w) => {
        words.push(w.trim());
        return `<span class="edq-word-slot" data-answer="${w.trim().toLowerCase()}"></span>`;
      });

      /* Банк слов (перемешиваем) */
      const bank = ce('div', 'edq-word-bank');
      [...words].sort(() => Math.random() - 0.5).forEach(w => {
        const chip = ce('span', 'edq-word-chip');
        chip.textContent = w;
        chip.dataset.word = w.toLowerCase();
        bank.appendChild(chip);
      });

      /* Текст со слотами */
      const textEl = ce('p', 'edq-word-text');
      textEl.innerHTML = html;

      qEl.appendChild(bank);
      qEl.appendChild(textEl);

      if (isTouchDevice()) {
        setupMobileDragWords(qEl, bank, textEl, q, idx);
      } else {
        setupDesktopDragWords(qEl, bank, textEl, q, idx);
      }
    }

    function setupDesktopDragWords(qEl, bank, textEl, q, idx) {
      let dragged = null;

      function attachChip(chip) {
        chip.setAttribute('draggable', 'true');
        chip.addEventListener('dragstart', e => {
          dragged = chip;
          chip.classList.add('edq-word-chip--dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        chip.addEventListener('dragend', () => {
          chip.classList.remove('edq-word-chip--dragging');
          dragged = null;
        });
      }

      bank.querySelectorAll('.edq-word-chip').forEach(attachChip);

      textEl.querySelectorAll('.edq-word-slot').forEach(slot => {
        slot.addEventListener('dragover', e => {
          e.preventDefault();
          slot.classList.add('edq-word-slot--over');
        });
        slot.addEventListener('dragleave', () => slot.classList.remove('edq-word-slot--over'));
        slot.addEventListener('drop', e => {
          e.preventDefault();
          slot.classList.remove('edq-word-slot--over');
          if (!dragged) return;
          /* Если слот занят — возвращаем предыдущий чип в банк */
          const existing = slot.querySelector('.edq-word-chip');
          if (existing) {
            const fromSlot = existing.closest('.edq-word-slot');
            if (fromSlot) fromSlot.classList.remove('edq-word-slot--filled');
            bank.appendChild(existing);
          }
          /* Если перетаскивают из другого слота — чистим его */
          const fromSlot = dragged.parentElement;
          if (fromSlot && fromSlot.classList.contains('edq-word-slot')) {
            fromSlot.classList.remove('edq-word-slot--filled');
          }
          slot.appendChild(dragged);
          slot.classList.add('edq-word-slot--filled');
          syncCheckBtn(qEl, q, idx);
        });
      });

      /* Банк принимает возврат */
      bank.addEventListener('dragover', e => e.preventDefault());
      bank.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragged) return;
        const fromSlot = dragged.parentElement;
        if (fromSlot && fromSlot.classList.contains('edq-word-slot')) {
          fromSlot.classList.remove('edq-word-slot--filled');
        }
        bank.appendChild(dragged);
        syncCheckBtn(qEl, q, idx);
      });
    }

    function setupMobileDragWords(qEl, bank, textEl, q, idx) {
      let selected = null;

      qEl.addEventListener('click', e => {
        const chip = e.target.closest('.edq-word-chip');
        const slot = e.target.closest('.edq-word-slot');
        const inBank = e.target.closest('.edq-word-bank');

        if (chip) {
          if (selected === chip) {
            chip.classList.remove('edq-word-chip--selected');
            selected = null;
          } else {
            if (selected) selected.classList.remove('edq-word-chip--selected');
            selected = chip;
            chip.classList.add('edq-word-chip--selected');
          }
          return;
        }

        if (!selected) return;

        if (slot) {
          const existing = slot.querySelector('.edq-word-chip');
          if (existing && existing !== selected) {
            const exFromSlot = existing.parentElement;
            if (exFromSlot && exFromSlot.classList.contains('edq-word-slot')) {
              exFromSlot.classList.remove('edq-word-slot--filled');
            }
            bank.appendChild(existing);
          }
          const fromSlot = selected.parentElement;
          if (fromSlot && fromSlot.classList.contains('edq-word-slot')) {
            fromSlot.classList.remove('edq-word-slot--filled');
          }
          slot.appendChild(selected);
          slot.classList.add('edq-word-slot--filled');
          selected.classList.remove('edq-word-chip--selected');
          selected = null;
          syncCheckBtn(qEl, q, idx);
        } else if (inBank) {
          const fromSlot = selected.parentElement;
          if (fromSlot && fromSlot.classList.contains('edq-word-slot')) {
            fromSlot.classList.remove('edq-word-slot--filled');
          }
          bank.appendChild(selected);
          selected.classList.remove('edq-word-chip--selected');
          selected = null;
          syncCheckBtn(qEl, q, idx);
        }
      });
    }

    /* ---- Проверка Drag the Words ---- */
    function checkDragWords(qEl, q) {
      let allCorrect = true;

      qEl.querySelectorAll('.edq-word-slot').forEach(slot => {
        const chip = slot.querySelector('.edq-word-chip');
        if (!chip) {
          allCorrect = false;
          slot.classList.add('edq-word-slot--incorrect');
          return;
        }
        const correct = chip.dataset.word === slot.dataset.answer;
        if (!correct) allCorrect = false;
        slot.classList.add(correct ? 'edq-word-slot--correct' : 'edq-word-slot--incorrect');
        chip.setAttribute('draggable', 'false');
        chip.style.cursor = 'default';
      });

      /* Чипы, оставшиеся в банке, — ошибка */
      qEl.querySelectorAll('.edq-word-bank .edq-word-chip').forEach(chip => {
        chip.setAttribute('draggable', 'false');
        chip.style.cursor = 'default';
        allCorrect = false;
      });

      return { correct: allCorrect, partial: false };
    }

    /* ---- Image Pairing ---- */
    function buildImagePairing(qEl, q, idx) {
      const grid = ce('div', 'edq-pairing-grid');
      const srcCol = ce('div', 'edq-pairing-col edq-pairing-col--source');
      const tgtCol = ce('div', 'edq-pairing-col edq-pairing-col--target');

      q.pairs.forEach((pair, i) => {
        srcCol.appendChild(makePairCard(pair.source, 'source', i));
      });

      [...q.pairs.map((p, i) => ({ content: p.target, pairId: i }))]
        .sort(() => Math.random() - 0.5)
        .forEach(({ content, pairId }) => {
          tgtCol.appendChild(makePairCard(content, 'target', pairId));
        });

      grid.appendChild(srcCol);
      grid.appendChild(tgtCol);
      qEl.appendChild(grid);

      qEl._pairing = { connections: new Map(), activeSource: null, counter: 0, locked: false };

      grid.addEventListener('click', e => {
        if (qEl._pairing.locked) return;
        const card = e.target.closest('.edq-pair-card');
        if (!card) return;
        const state = qEl._pairing;

        if (card.dataset.role === 'source') {
          if (state.activeSource === card) {
            card.classList.remove('edq-pair-card--active');
            state.activeSource = null;
          } else {
            if (state.activeSource) state.activeSource.classList.remove('edq-pair-card--active');
            state.activeSource = card;
            card.classList.add('edq-pair-card--active');
          }
        } else {
          /* Клик на цель без активного источника — снимаем пару */
          if (!state.activeSource) {
            for (const [src, tgt] of state.connections.entries()) {
              if (tgt === card) { pairingUnpair(src, card, state); break; }
            }
            return;
          }
          /* Освобождаем цель если она уже в паре */
          for (const [src, tgt] of state.connections.entries()) {
            if (tgt === card) { pairingUnpair(src, card, state); break; }
          }
          /* Освобождаем активный источник если он уже в паре */
          if (state.connections.has(state.activeSource)) {
            pairingUnpair(state.activeSource, state.connections.get(state.activeSource), state);
          }
          state.counter++;
          pairingPair(state.activeSource, card, state.counter, state);
          state.activeSource.classList.remove('edq-pair-card--active');
          state.activeSource = null;
          syncCheckBtn(qEl, q, idx);
        }
      });
    }

    function makePairCard(content, role, pairId) {
      const card = ce('div', `edq-pair-card edq-pair-card--${role}`);
      card.dataset.role = role;
      card.dataset.pairId = String(pairId);
      if (content.image) {
        const img = document.createElement('img');
        img.src = content.image;
        img.alt = content.alt || '';
        img.className = 'edq-pair-img';
        card.appendChild(img);
      }
      if (content.text) {
        const span = ce('span', 'edq-pair-text');
        span.innerHTML = content.text;
        card.appendChild(span);
      }
      card.appendChild(ce('span', 'edq-pair-badge'));
      return card;
    }

    function pairingPair(src, tgt, num, state) {
      state.connections.set(src, tgt);
      src.classList.add('edq-pair-card--paired');
      tgt.classList.add('edq-pair-card--paired');
      src.querySelector('.edq-pair-badge').textContent = num;
      tgt.querySelector('.edq-pair-badge').textContent = num;
    }

    function pairingUnpair(src, tgt, state) {
      state.connections.delete(src);
      src.classList.remove('edq-pair-card--paired');
      tgt.classList.remove('edq-pair-card--paired');
      src.querySelector('.edq-pair-badge').textContent = '';
      tgt.querySelector('.edq-pair-badge').textContent = '';
    }

    /* ---- Проверка Image Pairing ---- */
    function checkImagePairing(qEl, q) {
      const state = qEl._pairing;
      state.locked = true;
      let allCorrect = true;

      state.connections.forEach((tgtCard, srcCard) => {
        const correct = srcCard.dataset.pairId === tgtCard.dataset.pairId;
        if (!correct) allCorrect = false;
        srcCard.classList.add(correct ? 'edq-pair-card--correct' : 'edq-pair-card--incorrect');
        tgtCard.classList.add(correct ? 'edq-pair-card--correct' : 'edq-pair-card--incorrect');
      });

      /* Непарные источники → ошибка */
      qEl.querySelectorAll('.edq-pair-card--source').forEach(card => {
        if (!state.connections.has(card)) {
          allCorrect = false;
          card.classList.add('edq-pair-card--incorrect');
        }
      });

      return { correct: allCorrect, partial: false };
    }

    /* ---- Кнопки действий ---- */
    function buildActions(q, idx) {
      const actEl = ce('div', 'edq-actions');

      if (mode === 'practice') {
        const checkBtn = ce('button', 'edq-btn edq-btn--primary');
        checkBtn.textContent = 'Проверить';
        checkBtn.disabled = true; // активируется при выборе ответа
        checkBtn.addEventListener('click', () => checkQuestion(idx));
        actEl.appendChild(checkBtn);
      } else {
        /* test mode: «Далее» / «Завершить тест» */
        const isLast = idx === questions.length - 1;
        const nextBtn = ce('button', 'edq-btn edq-btn--next');
        nextBtn.textContent = isLast ? 'Завершить тест' : 'Далее →';
        nextBtn.disabled = true;
        nextBtn.addEventListener('click', () => {
          recordTestAnswer(idx);
          if (isLast) showResult();
          else showQuestion(idx + 1);
        });
        actEl.appendChild(nextBtn);
      }

      return actEl;
    }

    /* -- Синхронизация активности кнопки «Проверить» / «Далее» -- */
    function syncCheckBtn(qEl, q, idx) {
      const hasAnswer = checkHasAnswer(qEl, q);
      if (mode === 'practice') {
        const btn = qEl.querySelector('.edq-btn--primary');
        if (btn) btn.disabled = !hasAnswer;
      } else {
        const btn = qEl.querySelector('.edq-btn--next');
        if (btn && q.type !== 'drag-drop') btn.disabled = !hasAnswer;
      }
    }

    function checkHasAnswer(qEl, q) {
      switch (q.type) {
        case 'multiple-choice':
          return !!qEl.querySelector('.edq-option input:checked');
        case 'checkbox':
          return !!qEl.querySelector('.edq-option input:checked');
        case 'fill-gaps':
          return [...qEl.querySelectorAll('.edq-gap')].some(i => i.value.trim());
        case 'drag-drop':
          return qEl.querySelectorAll('.edq-zone-items .edq-drag-item').length > 0;
        case 'dropdown':
          return [...qEl.querySelectorAll('.edq-select')].every(s => s.value !== '');
        case 'drag-words':
          return qEl.querySelectorAll('.edq-word-slot.edq-word-slot--filled').length > 0;
        case 'image-pairing':
          return !!(qEl._pairing && qEl._pairing.connections.size > 0);
        default: return false;
      }
    }

    /* ==========================================
       ПРОВЕРКА ОТВЕТОВ (practice mode)
       ========================================== */
    function checkQuestion(idx) {
      const q = questions[idx];
      const qEl = questionEls[idx];
      let result;

      switch (q.type) {
        case 'multiple-choice': result = checkMC(qEl, q);        break;
        case 'checkbox':        result = checkCheckbox(qEl, q);  break;
        case 'fill-gaps':       result = checkFillGaps(qEl, q);  break;
        case 'drag-drop':       result = checkDragDrop(qEl, q);      break;
        case 'dropdown':        result = checkDropdown(qEl, q);      break;
        case 'drag-words':      result = checkDragWords(qEl, q);     break;
        case 'image-pairing':   result = checkImagePairing(qEl, q);  break;
        default: result = { correct: false, partial: false };
      }

      /* Запоминаем первую попытку */
      if (firstAttempt[idx] === null) firstAttempt[idx] = result.correct;

      /* Показываем question-level фидбек */
      const fbEl = qEl.querySelector('.edq-feedback');
      let fbText = '';
      if (q.feedback) {
        if (result.correct)          fbText = q.feedback.correct   || '';
        else if (result.partial)     fbText = q.feedback.partial   || q.feedback.incorrect || '';
        else if (q.type === 'dropdown' && result.combinedFeedback)
                                     fbText = result.combinedFeedback;
        else                         fbText = q.feedback.incorrect || '';
      } else if (q.type === 'dropdown' && result.combinedFeedback && !result.correct) {
        fbText = result.combinedFeedback;
      }
      if (fbText) {
        fbEl.innerHTML = fbText;
        fbEl.className = 'edq-feedback edq-feedback--' +
          (result.correct ? 'correct' : result.partial ? 'partial' : 'incorrect');
        fbEl.style.display = '';
      }

      /* Обновляем кнопки */
      const actEl = qEl.querySelector('.edq-actions');
      actEl.innerHTML = '';

      if (result.correct) {
        const isLast = idx === questions.length - 1;
        const nextBtn = ce('button', 'edq-btn edq-btn--next');
        nextBtn.textContent = isLast ? 'Готово ✓' : 'Далее →';
        nextBtn.addEventListener('click', () => {
          if (dotsEl) markDotDone(idx);
          if (isLast) finishPractice();
          else showQuestion(idx + 1);
        });
        actEl.appendChild(nextBtn);
      } else {
        const retryBtn = ce('button', 'edq-btn edq-btn--retry');
        retryBtn.textContent = 'Попробовать ещё раз';
        retryBtn.addEventListener('click', () => retryQuestion(idx));
        actEl.appendChild(retryBtn);

        /* «Пропустить» — чтобы не застрять */
        const skipBtn = ce('button', 'edq-btn edq-btn--skip');
        const isLast = idx === questions.length - 1;
        skipBtn.textContent = isLast ? 'Завершить' : 'Пропустить →';
        skipBtn.addEventListener('click', () => {
          if (dotsEl) markDotDone(idx);
          if (isLast) finishPractice();
          else showQuestion(idx + 1);
        });
        actEl.appendChild(skipBtn);
      }
    }

    /* ---- Проверка MC ---- */
    function checkMC(qEl, q) {
      const checked = qEl.querySelector('.edq-option input:checked');
      if (!checked) return { correct: false, partial: false };
      const oi = parseInt(checked.value);

      qEl.querySelectorAll('.edq-option').forEach((li, i) => {
        li.querySelector('input').disabled = true;
        li.classList.remove('edq-option--selected');
        li.classList.add('edq-option--disabled');

        /* Подсвечиваем только выбранный вариант */
        if (i === oi) {
          li.classList.add(q.options[i].correct ? 'edq-option--correct' : 'edq-option--incorrect');
        }
      });

      return { correct: q.options[oi].correct, partial: false };
    }

    /* ---- Проверка Checkbox ---- */
    function checkCheckbox(qEl, q) {
      const checkedSet = new Set(
        [...qEl.querySelectorAll('.edq-option input:checked')].map(i => parseInt(i.value))
      );
      const correctSet = new Set(
        q.options.reduce((acc, opt, i) => { if (opt.correct) acc.push(i); return acc; }, [])
      );

      let allCorrect = true;
      correctSet.forEach(i => { if (!checkedSet.has(i)) allCorrect = false; });
      checkedSet.forEach(i => { if (!correctSet.has(i)) allCorrect = false; });

      const anyCorrect = [...checkedSet].some(i => correctSet.has(i));
      const partial = !allCorrect && anyCorrect;

      qEl.querySelectorAll('.edq-option').forEach((li, i) => {
        li.querySelector('input').disabled = true;
        li.classList.remove('edq-option--selected');
        li.classList.add('edq-option--disabled');

        /* Подсвечиваем только то, что выбрал пользователь */
        if (checkedSet.has(i)) {
          li.classList.add(correctSet.has(i) ? 'edq-option--correct' : 'edq-option--incorrect');
        }
      });

      return { correct: allCorrect, partial };
    }

    /* ---- Проверка Fill in the Gaps ---- */
    function checkFillGaps(qEl, q) {
      let allCorrect = true;

      Object.keys(q.gaps).forEach(gapId => {
        const gap = q.gaps[gapId];
        const input = qEl.querySelector(`.edq-gap[data-gap-id="${gapId}"]`);
        if (!input) { allCorrect = false; return; }

        const value = input.value.trim().toLowerCase();
        const accepted = gap.answers.map(a => a.toLowerCase());
        const isCorrect = accepted.includes(value);

        if (!isCorrect) allCorrect = false;
        input.classList.add(isCorrect ? 'edq-gap--correct' : 'edq-gap--incorrect');
        input.readOnly = true;

        const wrap = input.closest('.edq-gap-wrap');

        /* Поле подсвечено цветом — фидбек в общем блоке под заданием */
      });

      return { correct: allCorrect, partial: false };
    }

    /* ---- Проверка Drag & Drop ---- */
    function checkDragDrop(qEl, q) {
      let allCorrect = true;

      qEl.querySelectorAll('.edq-drop-zone').forEach(zEl => {
        const zoneId = zEl.dataset.zoneId;
        const zone = q.zones.find(z => z.id === zoneId);
        if (!zone) return;

        const placed = [...zEl.querySelectorAll('.edq-zone-items .edq-drag-item')]
          .map(c => c.dataset.itemId);

        /* Проверяем каждую карточку */
        placed.forEach(itemId => {
          const chip = zEl.querySelector(`[data-item-id="${itemId}"]`);
          const correct = zone.correct.includes(itemId);
          if (!correct) { allCorrect = false; chip && chip.classList.add('edq-drag-item--incorrect'); }
          else { chip && chip.classList.add('edq-drag-item--correct'); }
          if (chip) { chip.setAttribute('draggable', 'false'); chip.style.cursor = 'default'; }
        });

        /* Если не все нужные попали в эту зону */
        zone.correct.forEach(id => { if (!placed.includes(id)) allCorrect = false; });

        /* Фидбек по зонам — в общем блоке под заданием */
      });

      /* Блокируем оставшееся в пуле */
      qEl.querySelectorAll('.edq-drag-pool .edq-drag-item').forEach(chip => {
        chip.setAttribute('draggable', 'false');
        chip.style.cursor = 'default';
        chip.classList.add('edq-drag-item--incorrect');
        allCorrect = false;
      });

      return { correct: allCorrect, partial: false };
    }

    /* ---- Проверка Dropdown ---- */
    function checkDropdown(qEl, q) {
      let allCorrect = true;
      const incorrectFeedbacks = [];

      qEl.querySelectorAll('.edq-dropdown-row').forEach((row, rowIdx) => {
        const sel = row.querySelector('.edq-select');
        const answer = row.dataset.answer;
        const isCorrect = sel.value === answer;
        const item = q.items[rowIdx];

        sel.classList.add('edq-select--locked');

        if (isCorrect) {
          row.classList.add('edq-dropdown-row--correct');
        } else {
          allCorrect = false;
          row.classList.add('edq-dropdown-row--incorrect');
          if (item && item.feedback) incorrectFeedbacks.push(item.feedback);
        }
      });

      const combinedFeedback = incorrectFeedbacks.length > 0
        ? incorrectFeedbacks.map(f => `<p>${f}</p>`).join('')
        : null;

      return { correct: allCorrect, partial: false, combinedFeedback };
    }

    /* ==========================================
       RETRY (practice mode)
       ========================================== */
    function retryQuestion(idx) {
      const q = questions[idx];
      const qEl = questionEls[idx];

      /* Скрываем фидбек вопроса */
      const fbEl = qEl.querySelector('.edq-feedback');
      fbEl.style.display = 'none';
      fbEl.className = 'edq-feedback';

      if (q.type === 'multiple-choice') {
        qEl.querySelectorAll('.edq-option').forEach(li => {
          li.className = 'edq-option';
          const inp = li.querySelector('input');
          inp.checked = false;
          inp.disabled = false;
          const ofb = li.querySelector('.edq-option-feedback');
          if (ofb) ofb.style.display = 'none';
        });

      } else if (q.type === 'checkbox') {
        qEl.querySelectorAll('.edq-option').forEach(li => {
          li.className = 'edq-option edq-option--checkbox';
          const inp = li.querySelector('input');
          inp.checked = false;
          inp.disabled = false;
          const ofb = li.querySelector('.edq-option-feedback');
          if (ofb) ofb.style.display = 'none';
        });

      } else if (q.type === 'fill-gaps') {
        Object.keys(q.gaps).forEach(gapId => {
          const input = qEl.querySelector(`.edq-gap[data-gap-id="${gapId}"]`);
          if (!input) return;
          if (input.classList.contains('edq-gap--correct')) return; // оставляем верные
          input.classList.remove('edq-gap--incorrect');
          input.value = '';
          input.readOnly = false;
          const wrap = input.closest('.edq-gap-wrap');
          const ansEl = wrap.querySelector('.edq-gap-answer');
          if (ansEl) ansEl.style.display = 'none';
          const gfb = wrap.querySelector('.edq-gap-feedback');
          if (gfb) { gfb.style.display = 'none'; gfb.className = 'edq-gap-feedback'; }
        });

      } else if (q.type === 'dropdown') {
        qEl.querySelectorAll('.edq-dropdown-row').forEach(row => {
          row.className = 'edq-dropdown-row';
          const sel = row.querySelector('.edq-select');
          sel.value = '';
          sel.classList.remove('edq-select--locked');
          const hint = row.querySelector('.edq-dropdown-hint');
          if (hint) hint.style.display = 'none';
        });

      } else if (q.type === 'drag-words') {
        const bank = qEl.querySelector('.edq-word-bank');
        qEl.querySelectorAll('.edq-word-slot').forEach(slot => {
          if (slot.classList.contains('edq-word-slot--correct')) return;
          const chip = slot.querySelector('.edq-word-chip');
          if (chip) {
            chip.setAttribute('draggable', 'true');
            chip.style.cursor = '';
            bank.appendChild(chip);
          }
          slot.classList.remove('edq-word-slot--filled', 'edq-word-slot--incorrect');
        });
        bank.querySelectorAll('.edq-word-chip').forEach(chip => {
          chip.setAttribute('draggable', 'true');
          chip.style.cursor = '';
        });

      } else if (q.type === 'image-pairing') {
        const state = qEl._pairing;
        const toRemove = [];
        state.connections.forEach((tgt, src) => {
          if (!src.classList.contains('edq-pair-card--correct')) toRemove.push([src, tgt]);
        });
        toRemove.forEach(([src, tgt]) => pairingUnpair(src, tgt, state));
        qEl.querySelectorAll('.edq-pair-card').forEach(card => {
          card.classList.remove('edq-pair-card--incorrect', 'edq-pair-card--active');
        });
        state.locked = false;
        state.activeSource = null;

      } else if (q.type === 'drag-drop') {
        const pool = qEl.querySelector('.edq-drag-pool');
        qEl.querySelectorAll('.edq-drop-zone').forEach(zEl => {
          const zoneId = zEl.dataset.zoneId;
          const zone = q.zones.find(z => z.id === zoneId);
          const zfb = zEl.querySelector('.edq-zone-feedback');
          if (zfb) zfb.style.display = 'none';

          zEl.querySelectorAll('.edq-zone-items .edq-drag-item').forEach(chip => {
            const isCorrect = zone.correct.includes(chip.dataset.itemId);
            if (!isCorrect) {
              chip.classList.remove('edq-drag-item--incorrect', 'edq-drag-item--selected');
              chip.setAttribute('draggable', 'true');
              chip.style.cursor = '';
              pool.appendChild(chip);
              if (qEl._attachDragItem) qEl._attachDragItem(chip);
            }
          });
        });
        /* Возвращаем incorrectly-placed в пуле */
        pool.querySelectorAll('.edq-drag-item').forEach(chip => {
          chip.classList.remove('edq-drag-item--incorrect', 'edq-drag-item--selected');
          chip.setAttribute('draggable', 'true');
          chip.style.cursor = '';
          if (qEl._attachDragItem) qEl._attachDragItem(chip);
        });
      }

      /* Восстанавливаем кнопку «Проверить» */
      const actEl = qEl.querySelector('.edq-actions');
      actEl.innerHTML = '';
      const checkBtn = ce('button', 'edq-btn edq-btn--primary');
      checkBtn.textContent = 'Проверить';
      checkBtn.disabled = !checkHasAnswer(qEl, q);
      checkBtn.addEventListener('click', () => checkQuestion(idx));
      actEl.appendChild(checkBtn);

      /* Подключаем syncCheckBtn снова для вновь активных вариантов */
      qEl.querySelectorAll('.edq-option input:not(:disabled)').forEach(inp => {
        inp.addEventListener('change', () => {
          if (!q.type === 'checkbox') {
            qEl.querySelectorAll('.edq-option').forEach(o => o.classList.remove('edq-option--selected'));
          }
          inp.closest('.edq-option').classList.toggle('edq-option--selected', inp.checked);
          syncCheckBtn(qEl, q, idx);
        });
      });
    }

    /* ==========================================
       НАВИГАЦИЯ
       ========================================== */
    function showQuestion(idx) {
      questionEls.forEach((qEl, i) => { qEl.style.display = i === idx ? '' : 'none'; });
      currentIdx = idx;

      if (dotsEl) {
        dotsEl.querySelectorAll('.edq-dot').forEach((d, i) => {
          d.classList.toggle('edq-dot--active', i === idx);
        });
      }
      if (progressCurEl) progressCurEl.textContent = idx + 1;
    }

    function markDotDone(idx) {
      if (!dotsEl) return;
      const dots = dotsEl.querySelectorAll('.edq-dot');
      if (dots[idx]) dots[idx].classList.add('edq-dot--done');
    }

    /* ---- Practice: завершение ---- */
    function finishPractice() {
      questionEls.forEach(qEl => { qEl.style.display = 'none'; });
      if (dotsEl) dotsEl.style.display = 'none';
      headEl.style.display = 'none';

      const done = ce('div', 'edq-done');
      const icon = ce('span', 'edq-done-icon');
      icon.textContent = '🎉';
      const msg = ce('p', '');
      msg.textContent = 'Разобрались!';
      done.appendChild(icon);
      done.appendChild(msg);
      container.appendChild(done);
    }

    /* ==========================================
       TEST MODE: запись ответа без проверки
       ========================================== */
    function recordTestAnswer(idx) {
      const q = questions[idx];
      const qEl = questionEls[idx];
      let correct = false;

      switch (q.type) {
        case 'multiple-choice': {
          const inp = qEl.querySelector('.edq-option input:checked');
          if (inp) correct = q.options[parseInt(inp.value)].correct;
          break;
        }
        case 'checkbox': {
          const checked = new Set(
            [...qEl.querySelectorAll('.edq-option input:checked')].map(i => parseInt(i.value))
          );
          const corrects = new Set(
            q.options.reduce((a, o, i) => { if (o.correct) a.push(i); return a; }, [])
          );
          correct = checked.size === corrects.size && [...checked].every(i => corrects.has(i));
          break;
        }
        case 'fill-gaps': {
          correct = Object.keys(q.gaps).every(gapId => {
            const gap = q.gaps[gapId];
            const input = qEl.querySelector(`.edq-gap[data-gap-id="${gapId}"]`);
            if (!input) return false;
            return gap.answers.map(a => a.toLowerCase()).includes(input.value.trim().toLowerCase());
          });
          break;
        }
        case 'dropdown': {
          correct = [...qEl.querySelectorAll('.edq-dropdown-row')].every(row => {
            const sel = row.querySelector('.edq-select');
            return sel && sel.value === row.dataset.answer;
          });
          break;
        }
        case 'drag-drop': {
          correct = q.zones.every(zone => {
            const zEl = qEl.querySelector(`[data-zone-id="${zone.id}"]`);
            if (!zEl) return false;
            const placed = [...zEl.querySelectorAll('.edq-zone-items .edq-drag-item')]
              .map(c => c.dataset.itemId);
            return placed.length === zone.correct.length &&
              zone.correct.every(id => placed.includes(id));
          });
          break;
        }
        case 'drag-words': {
          correct = [...qEl.querySelectorAll('.edq-word-slot')].every(slot => {
            const chip = slot.querySelector('.edq-word-chip');
            return chip && chip.dataset.word === slot.dataset.answer;
          });
          break;
        }
        case 'image-pairing': {
          const state = qEl._pairing;
          const totalSrc = qEl.querySelectorAll('.edq-pair-card--source').length;
          if (!state || state.connections.size !== totalSrc) { correct = false; break; }
          correct = [...state.connections.entries()].every(
            ([src, tgt]) => src.dataset.pairId === tgt.dataset.pairId
          );
          break;
        }
      }

      if (firstAttempt[idx] === null) firstAttempt[idx] = correct;
    }

    /* ==========================================
       TEST MODE: итоговый экран
       ========================================== */
    function showResult() {
      questionEls.forEach(qEl => { qEl.style.display = 'none'; });
      const progressEl = container.querySelector('.edq-progress-text');
      if (progressEl) progressEl.style.display = 'none';

      const correctCount = firstAttempt.filter(Boolean).length;
      const total = questions.length;

      resultEl.style.display = '';
      resultEl.innerHTML = '';

      /* Счёт */
      const scoreEl = ce('div', 'edq-score');
      scoreEl.innerHTML =
        `<span class="edq-score-num">${correctCount}</span>` +
        `<span class="edq-score-sep">из</span>` +
        `<span class="edq-score-total">${total}</span>`;
      resultEl.appendChild(scoreEl);

      const labelEl = ce('p', 'edq-score-label');
      if (correctCount === total)         labelEl.textContent = 'Всё верно — отличная работа!';
      else if (correctCount >= total / 2) labelEl.textContent = 'Хороший результат, есть что повторить.';
      else                                labelEl.textContent = 'Стоит перечитать урок и попробовать ещё раз.';
      resultEl.appendChild(labelEl);

      /* Разбор по вопросам */
      const listEl = ce('ol', 'edq-result-list');
      questions.forEach((q, i) => {
        const isCorrect = firstAttempt[i];
        const item = ce('li', 'edq-result-item edq-result-item--' + (isCorrect ? 'correct' : 'incorrect'));

        const header = ce('div', 'edq-result-item-header');
        const icon = ce('span', 'edq-result-icon');
        icon.textContent = isCorrect ? '✓' : '✗';
        const qText = ce('span', 'edq-result-q-text');
        qText.innerHTML = q.text.replace(/<[^>]+>/g, ''); // plain text
        header.appendChild(icon);
        header.appendChild(qText);
        item.appendChild(header);

        /* Для неверных: правильный ответ + авторский фидбек */
        if (!isCorrect) {
          const details = ce('div', 'edq-result-details');

          let correctAnswerHtml = '';
          if (q.type === 'multiple-choice' || q.type === 'checkbox') {
            const corrects = q.options.filter(o => o.correct).map(o => o.text).join(', ');
            correctAnswerHtml = 'Правильно: ' + corrects;
          } else if (q.type === 'fill-gaps') {
            correctAnswerHtml = 'Правильно: ' +
              Object.keys(q.gaps).map(k => q.gaps[k].answers[0]).join(', ');
          } else if (q.type === 'dropdown') {
            correctAnswerHtml = q.items.map(item => `${item.text}: <em>${item.answer}</em>`).join(' &middot; ');
          } else if (q.type === 'drag-words') {
            const slots = qEl.querySelectorAll('.edq-word-slot');
            const slotWords = [...slots].map(s => `<em>${s.dataset.answer}</em>`);
            correctAnswerHtml = 'Слова по порядку: ' + slotWords.join(', ');
          } else if (q.type === 'image-pairing') {
            correctAnswerHtml = q.pairs.map((pair, i) => {
              const src = pair.source.text || pair.source.alt || `Карточка ${i + 1}`;
              const tgt = pair.target.text || pair.target.alt || '';
              return `${src} → ${tgt}`;
            }).join(' &middot; ');
          } else if (q.type === 'drag-drop') {
            correctAnswerHtml = q.zones.map(z => {
              const names = z.correct
                .map(id => { const it = q.items.find(x => x.id === id); return it ? it.text : id; })
                .join(', ');
              return `<em>${z.label}:</em> ${names}`;
            }).join(' / ');
          }

          if (correctAnswerHtml) {
            const ansEl = ce('p', 'edq-result-correct-answer');
            ansEl.innerHTML = correctAnswerHtml;
            details.appendChild(ansEl);
          }

          if (q.feedback && q.feedback.incorrect) {
            const fbEl = ce('p', 'edq-result-feedback');
            fbEl.innerHTML = q.feedback.incorrect;
            details.appendChild(fbEl);
          }

          item.appendChild(details);
        }

        listEl.appendChild(item);
      });
      resultEl.appendChild(listEl);

      /* Кнопка «Пройти ещё раз» */
      const restartBtn = ce('button', 'edq-btn edq-btn--primary edq-btn--restart');
      restartBtn.textContent = 'Пройти ещё раз';
      restartBtn.addEventListener('click', () => initQuiz(container));
      resultEl.appendChild(restartBtn);
    }

  } /* конец initQuiz */

  /* ==========================================
     СТАРТ: ищем все .edq на странице
     ========================================== */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.edq').forEach(initQuiz);
  });

})();
