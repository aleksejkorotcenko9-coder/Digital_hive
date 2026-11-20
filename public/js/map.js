/* Карта пасек, осадков и медоносных растений.
   Leaflet (CDN) + базовые тайлы MapLibre Demo Tiles (адаптер maplibre-gl-leaflet).
   Пасеки появляются ТОЛЬКО после активации датчика по коду (localStorage,
   ключ "activatedSensors"). Пестициды и медоносы — полигоны из /data/map-layers.json.
   Осадки — радар RainViewer (последний кадр, opacity 0.6; сбой сети — молча пропускаем). */
(function () {
  'use strict';

  var STORAGE_KEY = 'activatedSensors';

  /* -------------------------------------------------------------- */
  /* localStorage: список активированных кодов                       */
  /* -------------------------------------------------------------- */

  function readActivated() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(function (c) { return typeof c === 'string'; }) : [];
    } catch (e) {
      return [];
    }
  }

  function writeActivated(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      /* приватный режим браузера — просто пропускаем */
    }
  }

  /* -------------------------------------------------------------- */
  /* Сообщения панели активации                                      */
  /* -------------------------------------------------------------- */

  var KIND_CLASS = { green: 'msg-green', red: 'msg-red', yellow: 'msg-yellow', gray: 'msg-gray' };

  function showMsg(kind, text) {
    var el = document.getElementById('activation-msg');
    if (!el) return;
    el.textContent = text;
    el.className = KIND_CLASS[kind] || 'msg-gray';
    el.style.display = 'block';
  }

  /* -------------------------------------------------------------- */
  /* Карта: база MapLibre Demo Tiles + группы слоёв                  */
  /* -------------------------------------------------------------- */

  var map;
  try {
    map = L.map('map').setView([55.7558, 37.6173], 10);
  } catch (e) {
    console.error('leaflet init failed', e);
    var errBox = document.getElementById('map-error');
    if (errBox) errBox.style.display = 'block';
    return;
  }

  try {
    L.maplibreGL({ style: 'https://demotiles.maplibre.org/style.json' }).addTo(map);
  } catch (e) {
    console.error('maplibre base layer failed', e);
  }

  var apiaryLayer = L.layerGroup();   // маркеры активированных пасек
  var pesticideLayer = L.layerGroup(); // красные полигоны
  var honeyLayer = L.layerGroup();     // зелёные полигоны медоносов
  var rainLayer = L.layerGroup();      // радар осадков (тайлы добавляются при успехе)

  apiaryLayer.addTo(map);
  pesticideLayer.addTo(map);
  honeyLayer.addTo(map);
  rainLayer.addTo(map);

  var layerControl = L.control.layers(
    {},
    {
      '🐝 Пасеки': apiaryLayer,
      '⚠️ Пестициды': pesticideLayer,
      '🌸 Медоносные растения': honeyLayer,
      '🌧 Осадки': rainLayer,
    },
    { position: 'topright' },
  );
  layerControl.addTo(map);

  /* -------------------------------------------------------------- */
  /* Данные слоёв: /data/map-layers.json                             */
  /* -------------------------------------------------------------- */

  var SENSORS = [];

  function findByCode(code) {
    for (var i = 0; i < SENSORS.length; i++) {
      if (SENSORS[i].code === code) return SENSORS[i];
    }
    return null;
  }

  function addApiaryMarker(sensor) {
    var marker = L.circleMarker([sensor.lat, sensor.lon], {
      radius: 10,
      color: '#166534',
      weight: 2,
      fillColor: '#22c55e',
      fillOpacity: 0.9,
    });
    marker.bindPopup(
      '<b>' + sensor.name + '</b><br>Ульев: ' + sensor.hiveCount + '<br>Датчик: ' + sensor.code,
    );
    marker._sensorCode = sensor.code;
    apiaryLayer.addLayer(marker);
  }

  function loadActivated(sensors) {
    var list = readActivated();
    var valid = [];
    for (var i = 0; i < list.length; i++) {
      var sensor = null;
      for (var j = 0; j < sensors.length; j++) {
        if (sensors[j].code === list[i]) {
          sensor = sensors[j];
          break;
        }
      }
      if (sensor) {
        addApiaryMarker(sensor);
        valid.push(list[i]);
      }
    }
    if (valid.length !== list.length) writeActivated(valid);
  }

  function renderActivatedList() {
    var ul = document.getElementById('activated-list');
    if (!ul) return;
    ul.innerHTML = '';
    var list = readActivated();
    if (!list.length) {
      var empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Активированных датчиков пока нет — пасеки на карте не показаны';
      ul.appendChild(empty);
      return;
    }
    list.forEach(function (code) {
      var sensor = findByCode(code);
      var li = document.createElement('li');
      var b = document.createElement('b');
      b.textContent = code;
      li.appendChild(b);
      li.appendChild(document.createTextNode(' — ' + (sensor ? sensor.name : 'неизвестная пасека') + ' '));
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'remove-btn';
      btn.setAttribute('data-code', code);
      btn.textContent = 'Удалить';
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function initLayers(data) {
    (data.pesticides || []).forEach(function (p) {
      var poly = L.polygon(p.coordinates, {
        color: '#dc2626',
        weight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.35,
      });
      poly.bindPopup('<b>' + p.name + '</b><br>Препарат: ' + p.pesticide + '<br>Дата обработки: ' + p.date);
      pesticideLayer.addLayer(poly);
    });
    (data.honeyPlants || []).forEach(function (h) {
      var poly = L.polygon(h.coordinates, {
        color: '#15803d',
        weight: 2,
        fillColor: '#22c55e',
        fillOpacity: 0.3,
      });
      poly.bindPopup('<b>' + h.name + '</b><br>Медонос: ' + h.plant);
      honeyLayer.addLayer(poly);
    });
  }

  fetch('/data/map-layers.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      SENSORS = Array.isArray(data.sensors) ? data.sensors : [];
      initLayers(data);
      loadActivated(SENSORS);
      renderActivatedList();
    })
    .catch(function (e) {
      console.error('map-layers.json failed', e);
      showMsg('gray', 'Не удалось загрузить слои карты — полигоны и датчики недоступны');
    });

  /* -------------------------------------------------------------- */
  /* Радар осадков RainViewer (последний кадр, opacity 0.6)          */
  /* -------------------------------------------------------------- */

  fetch('https://api.rainviewer.com/public/weather-maps.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (j) {
      var past = j && j.radar && j.radar.past;
      if (!past || !past.length) return;
      var frame = past[past.length - 1];
      var tiles = L.tileLayer(
        'https://tilecache.rainviewer.com' + frame.path + '/256/{z}/{x}/{y}/2/1_1.png',
        {
          opacity: 0.6,
          // радар RainViewer отдаёт нативные 256-тайлы только до 7 зума:
          // выше Leaflet сам масштабирует тайл вместо заглушки «Zoom Level Not Supported»
          maxNativeZoom: 7,
          maxZoom: 19,
        },
      );
      tiles.addTo(rainLayer);
    })
    .catch(function () {
      /* радар недоступен — пропускаем молча, слой остаётся пустым */
    });

  /* -------------------------------------------------------------- */
  /* Активация / деактивация датчиков                                */
  /* -------------------------------------------------------------- */

  function activateSensor() {
    var input = document.getElementById('sensor-code');
    var code = ((input && input.value) || '').trim().toUpperCase();
    if (!code) {
      showMsg('red', 'Введите код датчика');
      return;
    }
    var sensor = findByCode(code);
    if (!sensor) {
      showMsg('red', '❌ Код не найден');
      return;
    }
    var activated = readActivated();
    if (activated.indexOf(code) !== -1) {
      showMsg('yellow', '⚠️ Датчик уже активирован');
      return;
    }
    activated.push(code);
    writeActivated(activated);
    addApiaryMarker(sensor);
    renderActivatedList();
    showMsg('green', '✅ Датчик ' + code + ' активирован: ' + sensor.name);
    if (input) input.value = '';
  }

  var activateBtn = document.getElementById('activate-btn');
  if (activateBtn) activateBtn.addEventListener('click', activateSensor);

  var codeInput = document.getElementById('sensor-code');
  if (codeInput) {
    codeInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        activateSensor();
      }
    });
  }

  /* Удаление — делегированное событие по кнопкам с data-code */
  var activatedList = document.getElementById('activated-list');
  if (activatedList) {
    activatedList.addEventListener('click', function (ev) {
      var target = ev.target;
      var btn = target && target.closest ? target.closest('button[data-code]') : null;
      if (!btn) return;
      var code = btn.getAttribute('data-code');
      var rest = readActivated().filter(function (c) {
        return c !== code;
      });
      writeActivated(rest);
      var doomed = [];
      apiaryLayer.eachLayer(function (layer) {
        if (layer._sensorCode === code) doomed.push(layer);
      });
      doomed.forEach(function (layer) {
        apiaryLayer.removeLayer(layer);
      });
      renderActivatedList();
      showMsg('gray', 'Датчик ' + code + ' деактивирован');
    });
  }
})();
