/* ========================================
   EdSpire — Chem Finder
   Кликаешь по предмету — узнаёшь, какая
   область химии за ним стоит.
   ======================================== */

(function () {
  const items = document.querySelectorAll('.finder-item');
  const readout = document.getElementById('finder-readout');
  if (!items.length || !readout) return;

  const facts = {
    crocs: {
      field: 'химия высокомолекулярных соединений',
      text: 'Кроксы сделаны из полимера croslite — длинные молекулы цепляются друг за друга, отсюда лёгкость и упругость.',
      color: '#c8421a'
    },
    pill: {
      field: 'фармацевтическая химия',
      text: 'Аспирин — это ацетилсалициловая кислота. Химики придумали её больше 120 лет назад, и она до сих пор работает.',
      color: '#1a5dc8'
    },
    avocado: {
      field: 'биохимия',
      text: 'В авокадо много ненасыщенных жиров — у них особая структура молекул, из-за которой они полезны для сосудов.',
      color: '#2a7c4f'
    },
    egg: {
      field: 'химия белков',
      text: 'Когда яйцо жарится, белки сворачиваются — их длинные цепочки скручиваются и сцепляются. Назад уже не развернуть.',
      color: '#c8421a'
    },
    phone: {
      field: 'электрохимия',
      text: 'Телефон работает от литий-ионного аккумулятора — электрохимического устройства: ионы лития перемещаются между электродами и создают ток. Без электрохимии заряда бы просто не было.',
      color: '#6a4ec8'
    },
    apple: {
      field: 'химия реакций окисления',
      text: 'Срез яблока темнеет, потому что ферменты внутри реагируют с кислородом из воздуха. Это та же реакция, которая ржавит железо — только в замедленном кино.',
      color: '#c8421a'
    }
  };

  function show(key) {
    const f = facts[key];
    if (!f) return;
    readout.innerHTML = `
      <p class="readout-field" style="color: ${f.color}">${f.field}</p>
      <p class="readout-text">${f.text}</p>
    `;
    readout.classList.add('is-active');
  }

  items.forEach(btn => {
    btn.addEventListener('click', () => {
      items.forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      show(btn.dataset.key);
    });
  });
})();
