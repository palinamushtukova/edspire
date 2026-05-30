/* =============================================
   EdSpire — lesson-rating.js
   Рейтинг урока: 💩 😐 👍🏼
   Firebase Realtime Database + localStorage.
   ============================================= */
(function () {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey:            'AIzaSyDWMYLAA9ZxwhkzkpoXzn1ZqM302INp37E',
    authDomain:        'edspire-67836.firebaseapp.com',
    databaseURL:       'https://edspire-67836-default-rtdb.europe-west1.firebasedatabase.app',
    projectId:         'edspire-67836',
    storageBucket:     'edspire-67836.firebasestorage.app',
    messagingSenderId: '153512354919',
    appId:             '1:153512354919:web:0b7204e1e97168953be0c2'
  };

  document.addEventListener('DOMContentLoaded', function () {
    var container = document.querySelector('.lesson-rating');
    if (!container) return;

    var lessonId   = container.dataset.lesson;
    var storageKey = 'edspire_rating_' + lessonId;
    var votedKey   = localStorage.getItem(storageKey);

    /* -- Инициализируем Firebase -- */
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    var db         = firebase.database();
    var ratingsRef = db.ref('ratings/lesson-' + lessonId);

    /* -- Счётчики в реальном времени -- */
    ratingsRef.on('value', function (snapshot) {
      var data = snapshot.val() || {};
      ['bad', 'ok', 'good'].forEach(function (key) {
        var countEl = container.querySelector('[data-key="' + key + '"] .rating-count');
        if (countEl) countEl.textContent = data[key] !== undefined ? data[key] : 0;
      });
    });

    /* -- Если уже голосовали — блокируем -- */
    if (votedKey) {
      lockButtons(container, votedKey);
      return;
    }

    /* -- Голосование -- */
    container.querySelectorAll('.rating-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (localStorage.getItem(storageKey)) return;

        var key = btn.dataset.key;
        ratingsRef.child(key).transaction(
          function (current) { return (current || 0) + 1; },
          function (error, committed) {
            if (!error && committed) {
              localStorage.setItem(storageKey, key);
              lockButtons(container, key);
            }
          }
        );
      });
    });
  });

  function lockButtons(container, votedKey) {
    container.querySelectorAll('.rating-btn').forEach(function (btn) {
      btn.disabled = true;
      if (btn.dataset.key === votedKey) {
        btn.classList.add('rating-btn--voted');
      }
    });
  }

})();
