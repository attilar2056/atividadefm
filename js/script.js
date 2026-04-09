(function () {
  var hlsReadyPromise = null;
  function ensureHlsLoaded() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsReadyPromise) return hlsReadyPromise;
    hlsReadyPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1';
      script.async = true;
      script.onload = function () { resolve(window.Hls || null); };
      script.onerror = function () { reject(new Error('Falha ao carregar hls.js')); };
      document.head.appendChild(script);
    });
    return hlsReadyPromise;
  }

  function stripAccents(value) {
    var text = String(value || '');
    if (typeof text.normalize === 'function') {
      return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return text;
  }

  function normalizeWeekdayToken(value) {
    var text = stripAccents(String(value || '')).toLowerCase().replace(/[^a-z]/g, '');
    var map = {
      dom: 'dom', domingo: 'dom', sun: 'dom', sunday: 'dom',
      seg: 'seg', segunda: 'seg', segundafeira: 'seg', mon: 'seg', monday: 'seg',
      ter: 'ter', terca: 'ter', tercafeira: 'ter', tue: 'ter', tuesday: 'ter',
      quar: 'quar', quarta: 'quar', quartafeira: 'quar', wed: 'quar', wednesday: 'quar',
      qui: 'qui', quinta: 'qui', quintafeira: 'qui', thu: 'qui', thursday: 'qui',
      sex: 'sex', sexta: 'sex', sextafeira: 'sex', fri: 'sex', friday: 'sex',
      sab: 'sab', sabado: 'sab', sat: 'sab', saturday: 'sab'
    };
    return map[text] || '';
  }

  function normalizeWeekdays(value) {
    var source = Array.isArray(value) ? value : String(value || '').split(/[\s,;|]+/);
    var normalized = [];
    source.forEach(function (part) {
      var token = normalizeWeekdayToken(part);
      if (token && normalized.indexOf(token) === -1) normalized.push(token);
    });
    return normalized;
  }

  function cloneScheduleItem(item) {
    item = item || {};
    return {
      id: item.id || '',
      title: item.title || item.programa || '',
      host: item.host || item.locutor || '',
      locutor: item.locutor || item.host || '',
      start: item.start || item.inicio || '',
      end: item.end || item.fim || '',
      image: item.image || item.imagem || '',
      vinyl: item.vinyl || item.vinylImage || item.disco || '',
      diaDaSemana: normalizeWeekdays(item.diaDaSemana || item.dayOfWeek || item.days || item.weekdays || item.dias || []),
      photoX: Number(item.photoX || 0),
      photoY: Number(item.photoY || 0),
      photoZoom: Math.max(0.1, Number(item.photoZoom || 1) || 1)
    };
  }

  function parseSchedule(text) {
    return String(text || '').split(/\n+/).map(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return null;
      var parts = trimmed.split('|').map(function (p) { return p.trim(); });
      var range = String(parts[0] || '').split('-').map(function (p) { return p.trim(); });
      if (range.length !== 2) return null;
      return cloneScheduleItem({ start: range[0], end: range[1], title: parts[1] || '', image: parts[2] || '' });
    }).filter(Boolean);
  }

  function timeToMinutes(hhmm) {
    var m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  var WEEKDAY_ORDER = ['dom', 'seg', 'ter', 'quar', 'qui', 'sex', 'sab'];
  var DEFAULT_VINYL_PATH = 'assets/base/vinyl.png';
  var PROGRAMS_SOURCE_CACHE = Object.create(null);
  var TIME_SOURCE_CACHE = Object.create(null);

  function pad2(value) {
    return String(Math.max(0, Number(value) || 0)).padStart(2, '0');
  }

  function parseLocalIsoParts(isoText) {
    var match = String(isoText || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5])
    };
  }

  function buildClockContextFromIso(isoText, elapsedMs) {
    var parts = parseLocalIsoParts(isoText);
    if (!parts) return null;
    var date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0));
    if (Number(elapsedMs) > 0) date = new Date(date.getTime() + Number(elapsedMs));
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      weekday: WEEKDAY_ORDER[date.getUTCDay()],
      minutes: (date.getUTCHours() * 60) + date.getUTCMinutes(),
      isoLocal: date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate()) + 'T' + pad2(date.getUTCHours()) + ':' + pad2(date.getUTCMinutes())
    };
  }

  function fallbackClockContext(timeZone) {
    var formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    var parts = formatter.formatToParts(new Date());
    var map = {};
    parts.forEach(function (part) {
      if (part && part.type) map[part.type] = part.value;
    });
    var weekdayMap = { sun: 'dom', mon: 'seg', tue: 'ter', wed: 'quar', thu: 'qui', fri: 'sex', sat: 'sab' };
    var weekday = weekdayMap[String(map.weekday || '').toLowerCase()] || 'seg';
    return {
      year: Number(map.year || 0),
      month: Number(map.month || 0),
      day: Number(map.day || 0),
      weekday: weekday,
      minutes: (Number(map.hour || 0) * 60) + Number(map.minute || 0),
      isoLocal: String(map.year || '0000') + '-' + String(map.month || '00') + '-' + String(map.day || '00') + 'T' + String(map.hour || '00') + ':' + String(map.minute || '00')
    };
  }

  function findScheduleConfigHost(widget) {
    if (widget && widget.getAttribute('data-programs-src')) return widget;
    var owner = document.querySelector('[data-programs-src][data-type="schedule"], [data-programs-src][data-type="schedule-photo-current"], [data-programs-src].re-type-schedule, [data-programs-src].re-type-schedule-photo-current');
    if (owner) return owner;
    var anyProgramsSource = document.querySelector('[data-programs-src]');
    if (anyProgramsSource) return anyProgramsSource;
    return widget || null;
  }

  function getProgramsSourceUrl(widget) {
    var sourceHost = findScheduleConfigHost(widget);
    return (sourceHost && sourceHost.getAttribute('data-programs-src')) || 'programas/programacao.json';
  }

  function getTimeApiUrl(widget) {
    var sourceHost = findScheduleConfigHost(widget);
    return (sourceHost && sourceHost.getAttribute('data-time-api-url')) || 'https://api.open-meteo.com/v1/forecast?latitude=-23.5505&longitude=-46.6333&current=is_day&timezone=America/Sao_Paulo&forecast_days=1';
  }

  function getTimezoneForWidget(widget) {
    var sourceHost = findScheduleConfigHost(widget);
    return (sourceHost && sourceHost.getAttribute('data-timezone')) || 'America/Sao_Paulo';
  }

  function parseScheduleItemsFromWidgetFallback(widget) {
    var raw = widget.getAttribute('data-schedule-items') || '';
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed.map(cloneScheduleItem).filter(Boolean);
      } catch (_error) {}
    }
    return parseSchedule(widget.getAttribute('data-schedule') || '');
  }

  function parseProgramsPayload(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.programas)) return data.programas;
    if (data && Array.isArray(data.programs)) return data.programs;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function loadProgramsForWidget(widget) {
    var url = getProgramsSourceUrl(widget);
    if (!url) return Promise.resolve(parseScheduleItemsFromWidgetFallback(widget));
    if (!PROGRAMS_SOURCE_CACHE[url]) PROGRAMS_SOURCE_CACHE[url] = { items: null, promise: null };
    var cache = PROGRAMS_SOURCE_CACHE[url];
    if (cache.items && cache.items.length) return Promise.resolve(cache.items);
    if (cache.promise) return cache.promise;
    cache.promise = fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Falha ao carregar programação');
      return res.json();
    }).then(function (data) {
      var items = parseProgramsPayload(data).map(cloneScheduleItem).filter(Boolean);
      if (!items.length) throw new Error('Programação vazia');
      cache.items = items;
      cache.promise = null;
      return items;
    }, function () {
      cache.promise = null;
      cache.items = parseScheduleItemsFromWidgetFallback(widget);
      return cache.items;
    });
    return cache.promise;
  }

  function readClockContextFromApiPayload(data) {
    var current = data && data.current ? data.current : (data && data.current_weather ? data.current_weather : null);
    var isoText = current && current.time ? current.time : '';
    return buildClockContextFromIso(isoText, 0);
  }

  function primeClockForWidget(widget) {
    var url = getTimeApiUrl(widget);
    if (!url) return;
    if (!TIME_SOURCE_CACHE[url]) TIME_SOURCE_CACHE[url] = { baseIso: '', syncedAt: 0, promise: null };
    var cache = TIME_SOURCE_CACHE[url];
    var refreshMs = 15 * 60 * 1000;
    var isFresh = cache.baseIso && (Date.now() - cache.syncedAt) < refreshMs;
    if (isFresh || cache.promise) return;
    cache.promise = fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Falha ao sincronizar hora');
      return res.json();
    }).then(function (data) {
      var ctx = readClockContextFromApiPayload(data);
      if (ctx && ctx.isoLocal) {
        cache.baseIso = ctx.isoLocal;
        cache.syncedAt = Date.now();
      }
      cache.promise = null;
      return ctx;
    }, function () {
      cache.promise = null;
      return null;
    });
  }

  function currentClockContext(widget) {
    var url = getTimeApiUrl(widget);
    var timeZone = getTimezoneForWidget(widget);
    var cache = TIME_SOURCE_CACHE[url];
    if (cache && cache.baseIso) {
      var fromApi = buildClockContextFromIso(cache.baseIso, Date.now() - cache.syncedAt);
      if (fromApi) return fromApi;
    }
    return fallbackClockContext(timeZone);
  }

  function currentMinutesForTimezone(timeZone) {
    return fallbackClockContext(timeZone).minutes;
  }

  function previousWeekday(weekday) {
    var index = WEEKDAY_ORDER.indexOf(weekday);
    if (index === -1) return 'dom';
    return WEEKDAY_ORDER[(index + 6) % 7];
  }

  function matchesProgram(item, clock) {
    var start = timeToMinutes(item.start);
    var end = timeToMinutes(item.end);
    if (start === null || end === null || !clock) return false;
    var days = normalizeWeekdays(item.diaDaSemana || []);
    var hasDayFilter = days.length > 0;
    if (end >= start) {
      if (hasDayFilter && days.indexOf(clock.weekday) === -1) return false;
      return clock.minutes >= start && clock.minutes <= end;
    }
    if (clock.minutes >= start) {
      return !hasDayFilter || days.indexOf(clock.weekday) !== -1;
    }
    if (clock.minutes <= end) {
      return !hasDayFilter || days.indexOf(previousWeekday(clock.weekday)) !== -1;
    }
    return false;
  }

  function findProgram(items, clock) {
    for (var i = 0; i < items.length; i += 1) {
      if (matchesProgram(items[i], clock)) return items[i];
    }
    return null;
  }

  function isHlsUrl(url) {
    return /\.m3u8($|\?)/i.test(String(url || ''));
  }

  function createEngine(id, audio, hostNode) {
    audio.preload = 'auto';
    try { audio.setAttribute('playsinline', ''); } catch (_error) {}
    try { audio.crossOrigin = 'anonymous'; } catch (_error) {}
    return {
      id: id,
      hostNode: hostNode || null,
      audio: audio,
      hls: null,
      lastUrl: '',
      defaultVolume: Number(hostNode && hostNode.getAttribute('data-volume') || 1) || 1,
      wantPlay: false,
      waitingForAudio: false,
      audioDetected: false,
      audioContext: null,
      sourceNode: null,
      analyserNode: null,
      frequencyData: null,
      timeData: null,
      detectInterval: null,
      detectStartedAt: 0,
      analyserUnavailable: false
    };
  }

  function clearAudioDetection(engine) {
    if (!engine) return;
    if (engine.detectInterval) {
      clearInterval(engine.detectInterval);
      engine.detectInterval = null;
    }
  }


  function notifyEngineState(engine) {
    if (engine && typeof engine.onStateChange === 'function') engine.onStateChange();
  }

  function ensureAudioAnalyser(engine) {
    if (!engine || engine.analyserNode) return true;
    if (engine.analyserUnavailable) return false;
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('AudioContext indisponível');
      if (!window.__reSharedAudioContext) window.__reSharedAudioContext = new AudioContextClass();
      engine.audioContext = window.__reSharedAudioContext;
      if (!engine.sourceNode) engine.sourceNode = engine.audioContext.createMediaElementSource(engine.audio);
      engine.analyserNode = engine.audioContext.createAnalyser();
      engine.analyserNode.fftSize = 256;
      engine.analyserNode.smoothingTimeConstant = 0.78;
      engine.frequencyData = new Uint8Array(engine.analyserNode.frequencyBinCount);
      engine.timeData = new Uint8Array(engine.analyserNode.fftSize);
      engine.sourceNode.connect(engine.analyserNode);
      engine.analyserNode.connect(engine.audioContext.destination);
      return true;
    } catch (_error) {
      engine.analyserUnavailable = true;
      return false;
    }
  }

  function resumeAudioContext(engine) {
    if (!engine || !engine.audioContext || typeof engine.audioContext.resume !== 'function') return Promise.resolve();
    if (engine.audioContext.state === 'running') return Promise.resolve();
    try {
      var resumed = engine.audioContext.resume();
      if (resumed && typeof resumed.then === 'function') return resumed.catch(function () {});
    } catch (_error) {}
    return Promise.resolve();
  }

  function measureAudioPresence(engine) {
    if (!engine || !engine.analyserNode || !engine.frequencyData || !engine.timeData) return false;
    try {
      engine.analyserNode.getByteFrequencyData(engine.frequencyData);
      engine.analyserNode.getByteTimeDomainData(engine.timeData);
    } catch (_error) {
      return false;
    }

    var peakFrequency = 0;
    for (var i = 0; i < engine.frequencyData.length; i += 1) {
      if (engine.frequencyData[i] > peakFrequency) peakFrequency = engine.frequencyData[i];
    }

    var avgDeviation = 0;
    for (var j = 0; j < engine.timeData.length; j += 1) {
      avgDeviation += Math.abs(engine.timeData[j] - 128);
    }
    avgDeviation = avgDeviation / Math.max(1, engine.timeData.length);

    return peakFrequency >= 12 || avgDeviation >= 1.4;
  }

  function startAudioDetection(engine) {
    if (!engine) return;
    clearAudioDetection(engine);
    engine.detectStartedAt = Date.now();
    engine.waitingForAudio = !engine.audioDetected;
    engine.detectInterval = setInterval(function () {
      if (!engine.wantPlay) {
        clearAudioDetection(engine);
        return;
      }
      if (!engine.audio || engine.audio.paused || engine.audio.ended) return;
      if (engine.audioDetected) {
        engine.waitingForAudio = false;
        clearAudioDetection(engine);
        notifyEngineState(engine);
        return;
      }
      if (engine.audio.muted || Number(engine.audio.volume || 0) <= 0) {
        engine.waitingForAudio = false;
        notifyEngineState(engine);
        return;
      }

      var detected = measureAudioPresence(engine);
      if (detected) {
        engine.audioDetected = true;
        engine.waitingForAudio = false;
        clearAudioDetection(engine);
        notifyEngineState(engine);
        return;
      }

      engine.waitingForAudio = true;
      notifyEngineState(engine);
    }, 120);
  }

  function destroyHls(engine) {
    if (engine && engine.hls) {
      try { engine.hls.destroy(); } catch (_error) {}
      engine.hls = null;
    }
  }

  function attachSource(engine, url) {
    var safeUrl = String(url || '').trim();
    if (!engine || !safeUrl) return Promise.resolve(engine);
    if (engine.lastUrl === safeUrl) return Promise.resolve(engine);
    engine.lastUrl = safeUrl;
    destroyHls(engine);
    try { engine.audio.pause(); } catch (_error) {}
    try { engine.audio.removeAttribute('src'); engine.audio.load(); } catch (_error) {}

    if (isHlsUrl(safeUrl)) {
      return ensureHlsLoaded().then(function (Hls) {
        if (Hls && Hls.isSupported && Hls.isSupported()) {
          engine.hls = new Hls();
          engine.hls.loadSource(safeUrl);
          engine.hls.attachMedia(engine.audio);
        } else {
          engine.audio.src = safeUrl;
          try { engine.audio.load(); } catch (_error) {}
        }
        return engine;
      }).catch(function () {
        engine.audio.src = safeUrl;
        try { engine.audio.load(); } catch (_error) {}
        return engine;
      });
    }

    engine.audio.src = safeUrl;
    try { engine.audio.load(); } catch (_error) {}
    return Promise.resolve(engine);
  }

  function bindPlayers() {
    var engines = new Map();

    function updateSliderAppearance(slider) {
      if (!slider) return;
      var min = Number(slider.min || 0);
      var max = Number(slider.max || 100);
      var value = Number(slider.value || 0);
      var range = max - min || 1;
      var percent = Math.max(0, Math.min(100, ((value - min) / range) * 100));
      slider.style.setProperty('--volume-percent', percent.toFixed(2) + '%');
    }

    function ensureAudioControlMarkup() {
      Array.prototype.slice.call(document.querySelectorAll('.re-type-volume-control')).forEach(function (host) {
        var muteBtn = host.querySelector('.re-mute-btn');
        if (muteBtn) {
          muteBtn.textContent = '';
          muteBtn.setAttribute('title', 'Mutar ou desmutar');
        }
        if (!host.querySelector('.re-live-badge')) {
          var live = document.createElement('div');
          live.className = 're-live-badge';
          live.hidden = true;
          var dot = document.createElement('span');
          dot.className = 're-live-dot';
          var text = document.createElement('span');
          text.textContent = 'AO VIVO';
          live.appendChild(dot);
          live.appendChild(text);
          host.appendChild(live);
        }
        var slider = host.querySelector('.re-volume-slider');
        if (slider) updateSliderAppearance(slider);
      });

      Array.prototype.slice.call(document.querySelectorAll('.re-type-player .re-mute-btn')).forEach(function (btn) {
        btn.textContent = '';
      });
    }

    var controls = Array.prototype.slice.call(document.querySelectorAll('.re-type-player, .re-type-play-toggle, .re-type-volume-control, .re-type-vinyl'));
    ensureAudioControlMarkup();
    var actualPlayers = Array.prototype.slice.call(document.querySelectorAll('.re-type-player'));

    actualPlayers.forEach(function (player) {
      var audio = player.querySelector('.re-audio');
      if (!audio) return;
      var id = player.getAttribute('data-id');
      var engine = createEngine(id, audio, player);
      engine.onStateChange = function () { syncAll(); };
      engine.audio.volume = Math.max(0, Math.min(1, Number(player.getAttribute('data-volume') || 1)));
      engines.set(id, engine);
      var url = player.getAttribute('data-radio-url') || '';
      attachSource(engine, url);
      ['play', 'pause', 'ended', 'volumechange', 'playing', 'canplay', 'canplaythrough', 'loadstart', 'loadedmetadata', 'waiting', 'stalled'].forEach(function (eventName) {
        audio.addEventListener(eventName, function () {
          if (eventName === 'pause' || eventName === 'ended') {
            if (!engine.wantPlay) {
              engine.waitingForAudio = false;
              engine.audioDetected = false;
            }
          }
          if (eventName === 'waiting' && engine.wantPlay && !engine.audioDetected && !audio.muted && Number(audio.volume || 0) > 0) {
            engine.waitingForAudio = true;
          }
          if (eventName === 'playing' && engine.wantPlay && !engine.audioDetected && !audio.muted && Number(audio.volume || 0) > 0) {
            engine.waitingForAudio = true;
            startAudioDetection(engine);
          }
          if (eventName === 'volumechange' && (audio.muted || Number(audio.volume || 0) <= 0) && !engine.audioDetected) {
            engine.waitingForAudio = false;
          }
          if (eventName === 'volumechange' && !audio.muted && Number(audio.volume || 0) > 0 && engine.wantPlay && !engine.audioDetected) {
            engine.waitingForAudio = true;
            startAudioDetection(engine);
          }
          notifyEngineState(engine);
        });
      });
      audio.addEventListener('error', function () {
        engine.wantPlay = false;
        engine.waitingForAudio = false;
        engine.audioDetected = false;
        clearAudioDetection(engine);
        notifyEngineState(engine);
      });
    });

    function engineFromControl(control) {
      if (!control) return actualPlayers[0] ? engines.get(actualPlayers[0].getAttribute('data-id')) : null;
      var host = control.classList.contains('re-element') ? control : control.closest('.re-element');
      if (!host) return actualPlayers[0] ? engines.get(actualPlayers[0].getAttribute('data-id')) : null;
      if (host.classList.contains('re-type-player')) return engines.get(host.getAttribute('data-id')) || null;
      var linkedId = host.getAttribute('data-linked-player-id');
      if (linkedId && engines.has(linkedId)) return engines.get(linkedId);
      var ownUrl = String(host.getAttribute('data-radio-url') || '').trim();

      if (ownUrl) {
        for (var i = 0; i < actualPlayers.length; i += 1) {
          var playerHost = actualPlayers[i];
          var playerUrl = String(playerHost.getAttribute('data-radio-url') || '').trim();
          if (playerUrl && playerUrl === ownUrl) {
            return engines.get(playerHost.getAttribute('data-id')) || null;
          }
        }
      }

      if (!linkedId && actualPlayers.length === 1) {
        var onlyPlayer = actualPlayers[0];
        var onlyPlayerUrl = String(onlyPlayer.getAttribute('data-radio-url') || '').trim();
        if (!ownUrl || !onlyPlayerUrl || ownUrl === onlyPlayerUrl) {
          return engines.get(onlyPlayer.getAttribute('data-id')) || null;
        }
      }

      if (ownUrl) {
        var runtimeId = host.getAttribute('data-runtime-player-id');
        if (!runtimeId) {
          runtimeId = 'virtual-' + btoa(unescape(encodeURIComponent(ownUrl))).replace(/[^a-z0-9]/gi, '').slice(0, 24);
          host.setAttribute('data-runtime-player-id', runtimeId);
        }
        if (!engines.has(runtimeId)) {
          var audio = new Audio();
          var engine = createEngine(runtimeId, audio, null);
          engine.onStateChange = function () { syncAll(); };
          engines.set(runtimeId, engine);
          attachSource(engine, ownUrl);
          ['play', 'pause', 'ended', 'volumechange', 'playing', 'canplay', 'canplaythrough', 'loadstart', 'loadedmetadata', 'waiting', 'stalled'].forEach(function (eventName) {
            audio.addEventListener(eventName, function () { syncAll(); });
          });
          audio.addEventListener('error', function () { syncAll(); });
        }
        return engines.get(runtimeId);
      }
      return actualPlayers[0] ? engines.get(actualPlayers[0].getAttribute('data-id')) : null;
    }

    function matchesEngine(host, engine) {
      if (!host || !engine) return false;
      if (host.classList.contains('re-type-player')) return host.getAttribute('data-id') === engine.id;
      if (host.getAttribute('data-linked-player-id')) return host.getAttribute('data-linked-player-id') === engine.id;
      if (host.classList.contains('re-type-vinyl') && !host.getAttribute('data-linked-player-id') && actualPlayers.length === 1) return engine.id === actualPlayers[0].getAttribute('data-id');
      if (host.getAttribute('data-runtime-player-id')) return host.getAttribute('data-runtime-player-id') === engine.id;
      if (host.getAttribute('data-radio-url') && engine.lastUrl === host.getAttribute('data-radio-url')) return true;
      var firstPlayer = actualPlayers[0];
      return !!firstPlayer && engine.id === firstPlayer.getAttribute('data-id');
    }

    function syncHost(host, engine) {
      if (!host || !engine) return;
      var audio = engine.audio;
      var started = !!engine.wantPlay;
      var muted = !!audio && (!!audio.muted || Number(audio.volume || 0) === 0);
      var liveActive = started && !!engine.audioDetected && !!audio && !audio.paused && !audio.ended;
      var loading = started && !liveActive && !!engine.waitingForAudio && !muted;
      var volumeValue = Math.round(Math.max(0, Math.min(1, Number(audio.volume || 0))) * 100);
      host.classList.toggle('is-playing', started);
      host.classList.toggle('is-live-active', liveActive);
      host.classList.toggle('is-loading', loading);
      host.classList.toggle('is-muted', muted);
      var live = host.querySelector('.re-live-badge');
      if (live) {
        var liveText = live.querySelector('span:last-child');
        live.hidden = !(liveActive || loading);
        live.classList.toggle('is-loading', loading);
        live.classList.toggle('is-live', liveActive);
        if (liveText) liveText.textContent = loading ? 'CARREGANDO AGUARDE' : 'AO VIVO';
      }
      var muteBtn = host.querySelector('.re-mute-btn');
      if (muteBtn) {
        muteBtn.setAttribute('aria-label', muted ? 'Desmutar' : 'Mutar');
        muteBtn.setAttribute('title', muted ? 'Desmutar' : 'Mutar');
      }
      var slider = host.querySelector('.re-volume-slider');
      if (slider && String(slider.value) !== String(volumeValue)) slider.value = String(volumeValue);
      if (slider) updateSliderAppearance(slider);
    }

    function syncAll() {
      engines.forEach(function (engine) {
        controls.forEach(function (host) {
          if (matchesEngine(host, engine)) syncHost(host, engine);
        });
      });
    }

    function stopEngine(engine) {
      if (!engine) return;
      engine.wantPlay = false;
      engine.waitingForAudio = false;
      engine.audioDetected = false;
      clearAudioDetection(engine);
      try { engine.audio.pause(); } catch (_error) {}
      try { if (Number.isFinite(engine.audio.currentTime)) engine.audio.currentTime = 0; } catch (_error) {}
      notifyEngineState(engine);
    }

    function setPlayState(control, shouldPlay) {
      var engine = engineFromControl(control);
      if (!engine) return;
      var url = '';
      if (engine.hostNode) url = engine.hostNode.getAttribute('data-radio-url') || '';
      if (!url && control) {
        var host = control.classList.contains('re-element') ? control : control.closest('.re-element');
        url = host ? (host.getAttribute('data-radio-url') || '') : '';
      }
      if (shouldPlay) {
        engine.wantPlay = true;
        engine.waitingForAudio = true;
        engine.audioDetected = false;
        ensureAudioAnalyser(engine);
        notifyEngineState(engine);
        attachSource(engine, url).then(function () {
          try {
            if (engine.audio.readyState < 2) engine.audio.load();
          } catch (_error) {}
          resumeAudioContext(engine).then(function () {
            var p = engine.audio.play();
            if (p && typeof p.catch === 'function') {
              p.catch(function () {
                engine.wantPlay = false;
                engine.waitingForAudio = false;
                engine.audioDetected = false;
                clearAudioDetection(engine);
                notifyEngineState(engine);
              });
            }
            startAudioDetection(engine);
            setTimeout(syncAll, 20);
            setTimeout(syncAll, 180);
            setTimeout(syncAll, 600);
          });
        });
      } else {
        stopEngine(engine);
        setTimeout(syncAll, 20);
        setTimeout(syncAll, 180);
      }
    }

    function toggleMute(control) {
      var engine = engineFromControl(control);
      if (!engine) return;
      engine.audio.muted = !engine.audio.muted;
      notifyEngineState(engine);
    }

    function setVolume(control, value) {
      var engine = engineFromControl(control);
      if (!engine) return;
      engine.audio.volume = Math.max(0, Math.min(1, Number(value || 0) / 100));
      if (engine.audio.volume > 0 && engine.audio.muted) engine.audio.muted = false;
      var host = control && (control.classList.contains('re-element') ? control : control.closest('.re-element'));
      var slider = host ? host.querySelector('.re-volume-slider') : null;
      if (slider) updateSliderAppearance(slider);
      notifyEngineState(engine);
    }

    Array.prototype.slice.call(document.querySelectorAll('.re-play-btn')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var host = btn.closest('.re-element') || btn.parentElement;
        var engine = engineFromControl(host);
        if (!engine) return;
        setPlayState(host, engine.audio.paused || engine.audio.ended);
      });
    });
    Array.prototype.slice.call(document.querySelectorAll('.re-mute-btn')).forEach(function (btn) {
      btn.addEventListener('click', function () { toggleMute(btn.closest('.re-element') || btn.parentElement); });
    });
    Array.prototype.slice.call(document.querySelectorAll('.re-volume-slider')).forEach(function (slider) {
      updateSliderAppearance(slider);
      slider.addEventListener('input', function () {
        updateSliderAppearance(slider);
        setVolume(slider.closest('.re-element') || slider.parentElement, slider.value);
      });
    });

    syncAll();

    Array.prototype.slice.call(document.querySelectorAll('.re-type-player .re-audio')).forEach(function (audio) {
      try {
        audio.load();
      } catch (_error) {}
    });
  }



  function bindResponsiveStage() {
    var stage = document.getElementById('page-stage');
    var wrapper = document.getElementById('page-stage-wrapper');
    if (!stage || !wrapper) return;

    function getViewportBox() {
      var vv = window.visualViewport;
      return {
        width: Math.max(1, Math.round((vv && vv.width) || document.documentElement.clientWidth || window.innerWidth || 0)),
        height: Math.max(1, Math.round((vv && vv.height) || document.documentElement.clientHeight || window.innerHeight || 0))
      };
    }

    function isTouchDevice() {
      return !!(
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        navigator.maxTouchPoints > 0 ||
        /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent || '')
      );
    }

    var scheduled = false;
    function getDesktopContentHeight() {
      var maxBottom = 0;
      Array.prototype.slice.call(stage.querySelectorAll('.re-element')).forEach(function (el) {
        var rectBottom = el.offsetTop + el.offsetHeight;
        if (rectBottom > maxBottom) maxBottom = rectBottom;
      });
      return Math.max(1, Math.ceil(maxBottom + 8));
    }

    function updateStageScale() {
      scheduled = false;
      var rootStyle = getComputedStyle(document.documentElement);
      var baseWidth = parseFloat(rootStyle.getPropertyValue('--re-stage-width')) || 1380;
      var baseHeight = parseFloat(rootStyle.getPropertyValue('--re-stage-height')) || 1008;
      var viewport = getViewportBox();
      var touch = isTouchDevice();
      var portrait = viewport.height >= viewport.width;
      var narrowScreen = viewport.width <= 900;
      var useTouchLandscape = touch && !portrait;
      var gutter = useTouchLandscape ? 0 : (narrowScreen ? 0 : 24);
      var availableWidth = Math.max(1, viewport.width - gutter);
      var availableHeight = Math.max(1, viewport.height - (touch ? 0 : 12));
      var widthScale = availableWidth / baseWidth;
      var heightScale = availableHeight / baseHeight;
      var scale = useTouchLandscape ? widthScale : Math.min(1, widthScale);
      if (!useTouchLandscape && touch && portrait) {
        scale = Math.min(1, widthScale);
      }
      var scaledWidth = Math.max(1, Math.round(baseWidth * scale));
      var effectiveContentHeight = useTouchLandscape ? Math.min(baseHeight, getDesktopContentHeight()) : baseHeight;
      var scaledHeight = Math.max(1, Math.round(effectiveContentHeight * scale));

      document.body.classList.toggle('re-touch-device', touch);
      document.body.classList.toggle('re-touch-portrait', touch && portrait);
      document.body.classList.toggle('re-touch-landscape', touch && !portrait);
      document.body.classList.toggle('re-desktop-device', !touch);

      wrapper.style.width = scaledWidth + 'px';
      wrapper.style.height = scaledHeight + 'px';
      wrapper.style.maxWidth = '100%';
      stage.style.transformOrigin = 'top left';
      stage.style.transform = 'translateZ(0) scale(' + scale + ')';
      document.body.style.minHeight = Math.max(scaledHeight, viewport.height) + 'px';
      document.body.style.width = '100%';
    }

    function requestUpdate() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(updateStageScale);
    }

    updateStageScale();
    window.addEventListener('resize', requestUpdate, { passive: true });
    window.addEventListener('orientationchange', requestUpdate, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', requestUpdate, { passive: true });
      window.visualViewport.addEventListener('scroll', requestUpdate, { passive: true });
    }
  }

  function bindThemeToggles() {
    var root = document.documentElement;
    var body = document.body;
    var stage = document.getElementById('page-stage');
    function sync() {
      var isDark = root.classList.contains('re-dark-theme') || body.classList.contains('re-dark-theme');
      Array.prototype.slice.call(document.querySelectorAll('.re-theme-toggle-btn')).forEach(function (btn) {
        btn.classList.toggle('is-dark', isDark);
      });
      Array.prototype.slice.call(document.querySelectorAll('.re-theme-icon-box')).forEach(function (box) {
        box.classList.toggle('is-dark', isDark);
      });
      if (stage) stage.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
    Array.prototype.slice.call(document.querySelectorAll('.re-theme-toggle-btn')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        root.classList.toggle('re-dark-theme');
        body.classList.toggle('re-dark-theme');
        sync();
      });
    });
    sync();
  }

  function parseScheduleItemsFromWidget(widget) {
    return parseScheduleItemsFromWidgetFallback(widget);
  }

  function parseScheduleLayout(widget) {
    var raw = widget.getAttribute('data-schedule-layout') || '';
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        return {
          photoFrameX: Number(parsed.photoFrameX || 0),
          photoFrameY: Number(parsed.photoFrameY || 0),
          photoFrameW: Math.max(20, Number(parsed.photoFrameW || 132)),
          photoFrameH: Math.max(20, Number(parsed.photoFrameH || 106)),
          titleX: Number(parsed.titleX || 146),
          titleY: Number(parsed.titleY || 14),
          hostX: Number(parsed.hostX || 146),
          hostY: Number(parsed.hostY || 48),
          timeX: Number(parsed.timeX || 146),
          timeY: Number(parsed.timeY || 80)
        };
      } catch (_error) {}
    }
    return { photoFrameX: 0, photoFrameY: 0, photoFrameW: 132, photoFrameH: 106, titleX: 146, titleY: 14, hostX: 146, hostY: 48, timeX: 146, timeY: 80 };
  }


  function bindNewsWidgets() {
    var widgets = Array.prototype.slice.call(document.querySelectorAll('.re-type-news'));
    widgets.forEach(function (widget) {
      var list = widget.querySelector('.re-news-list');
      if (!list) return;
      var apiUrl = widget.getAttribute('data-news-api-url') || 'https://api.rss2json.com/v1/api.json?rss_url=https://g1.globo.com/rss/g1/';
      var maxItems = Math.max(1, Math.min(20, Number(widget.getAttribute('data-news-count') || 8) || 8));
      var itemsPerView = Math.max(1, Math.min(3, Number(widget.getAttribute('data-news-items-per-view') || 2) || 2));
      var rotateSeconds = Math.max(15, Math.min(60, Number(widget.getAttribute('data-news-rotate-seconds') || 15) || 15));
      var errorText = widget.getAttribute('data-news-error-text') || 'Erro ao carregar';
      var rotationTimer = null;
      list.textContent = 'Carregando...';
      fetch(apiUrl).then(function (res) {
        return res.json();
      }).then(function (data) {
        var items = Array.isArray(data && data.items) ? data.items.slice(0, maxItems) : [];
        if (!items.length) throw new Error('Sem notícias');
        var groupStart = 0;
        function renderGroup() {
          list.innerHTML = '';
          var group = items.slice(groupStart, groupStart + itemsPerView);
          if (!group.length) {
            groupStart = 0;
            group = items.slice(0, itemsPerView);
          }
          group.forEach(function (item) {
            var row = document.createElement('div');
            row.className = 're-news-item';
            var link = document.createElement('a');
            link.href = item.link || '#';
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = item.title || 'Sem título';
            var date = document.createElement('div');
            date.className = 're-news-date';
            var rawDate = item.pubDate ? new Date(item.pubDate) : null;
            date.textContent = rawDate && !isNaN(rawDate.getTime()) ? rawDate.toLocaleString('pt-BR') : '';
            row.appendChild(link);
            row.appendChild(date);
            list.appendChild(row);
          });
        }
        renderGroup();
        if (rotationTimer) clearInterval(rotationTimer);
        if (items.length > itemsPerView) {
          rotationTimer = setInterval(function () {
            groupStart += itemsPerView;
            if (groupStart >= items.length) groupStart = 0;
            renderGroup();
          }, rotateSeconds * 1000);
        }
      }).catch(function () {
        list.textContent = errorText;
      });
    });
  }

  function defaultWeatherLayout(raw) {
    raw = raw || {};
    return {
      cityX: Number.isFinite(Number(raw.cityX)) ? Number(raw.cityX) : 32,
      cityY: Number.isFinite(Number(raw.cityY)) ? Number(raw.cityY) : 34,
      tempX: Number.isFinite(Number(raw.tempX)) ? Number(raw.tempX) : 32,
      tempY: Number.isFinite(Number(raw.tempY)) ? Number(raw.tempY) : 106,
      cityFontSize: Math.max(8, Number.isFinite(Number(raw.cityFontSize)) ? Number(raw.cityFontSize) : 24),
      tempFontSize: Math.max(8, Number.isFinite(Number(raw.tempFontSize)) ? Number(raw.tempFontSize) : 58),
      cityManual: raw.cityManual === true,
      tempManual: raw.tempManual === true,
      cityAutoYRatio: Number.isFinite(Number(raw.cityAutoYRatio)) ? Number(raw.cityAutoYRatio) : 0.15,
      tempAutoYRatio: Number.isFinite(Number(raw.tempAutoYRatio)) ? Number(raw.tempAutoYRatio) : 0.45
    };
  }

  function parseWeatherLayout(widget) {
    var raw = widget.getAttribute('data-weather-layout') || '';
    if (raw) {
      try {
        return defaultWeatherLayout(JSON.parse(raw));
      } catch (_error) {}
    }
    return defaultWeatherLayout({});
  }

  function applyWeatherTextLayout(widget, node, layout, key) {
    if (!widget || !node) return;
    var isCity = key === 'city';
    var manual = !!(isCity ? layout.cityManual : layout.tempManual);
    var ratio = Number(isCity ? layout.cityAutoYRatio : layout.tempAutoYRatio);
    var top = manual
      ? Number(isCity ? layout.cityY : layout.tempY)
      : Math.round(widget.clientHeight * (Number.isFinite(ratio) ? ratio : (isCity ? 0.15 : 0.45)));
    node.style.top = top + 'px';
    node.style.fontSize = Math.max(8, Number(isCity ? layout.cityFontSize : layout.tempFontSize) || (isCity ? 24 : 58)) + 'px';
    if (manual) {
      node.style.left = Number(isCity ? layout.cityX : layout.tempX) + 'px';
      node.style.transform = 'none';
    } else {
      node.style.left = '50%';
      node.style.transform = 'translateX(-50%)';
    }
  }

  function bindWeatherWidgets() {
    var widgets = Array.prototype.slice.call(document.querySelectorAll('.re-type-weather-rio'));
    widgets.forEach(function (widget) {
      var cityEl = widget.querySelector('.re-weather-city');
      var tempEl = widget.querySelector('.re-weather-temp');
      var layout = parseWeatherLayout(widget);
      applyWeatherTextLayout(widget, cityEl, layout, 'city');
      applyWeatherTextLayout(widget, tempEl, layout, 'temp');
      var apiUrl = widget.getAttribute('data-weather-api-url') || 'https://api.open-meteo.com/v1/forecast?latitude=-22.9068&longitude=-43.1729&current_weather=true&timezone=America/Sao_Paulo';
      fetch(apiUrl).then(function (res) { return res.json(); }).then(function (data) {
        var weather = data && data.current_weather ? data.current_weather : null;
        var temp = Number(weather && weather.temperature);
        if (tempEl) tempEl.textContent = Number.isFinite(temp) ? temp.toFixed(1) + '°C' : '--.-°C';
      }).catch(function (error) {
        console.error('Erro ao buscar clima:', error);
        if (tempEl) tempEl.textContent = '--.-°C';
      });
    });
  }

  function bindImageLoops() {
    var widgets = Array.prototype.slice.call(document.querySelectorAll('.re-type-image-loop'));
    widgets.forEach(function (widget) {
      var img = widget.querySelector('.re-image-loop-img');
      if (!img) return;
      var items = [];
      try { items = JSON.parse(widget.getAttribute('data-image-loop-images') || '[]'); } catch (_error) {}
      items = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!items.length) return;
      var index = 0;
      img.src = items[0];
      img.style.opacity = '1';
      img.style.transition = 'opacity .45s ease';
      var seconds = Math.max(15, Number(widget.getAttribute('data-image-loop-seconds') || 15) || 15);
      if (items.length > 1) {
        setInterval(function () {
          index = (index + 1) % items.length;
          img.style.opacity = '0';
          setTimeout(function () {
            img.src = items[index];
            img.style.opacity = '1';
          }, 220);
        }, seconds * 1000);
      }
    });
  }

  function bindSchedules() {
    var fullWidgets = Array.prototype.slice.call(document.querySelectorAll('.re-type-schedule'));
    var photoWidgets = Array.prototype.slice.call(document.querySelectorAll('.re-type-schedule-photo-current'));
    var vinylWidgets = Array.prototype.slice.call(document.querySelectorAll('.re-type-vinyl'));
    var allWidgets = fullWidgets.concat(photoWidgets, vinylWidgets);

    function ensureWidgetPrograms(widget) {
      if (widget.__reScheduleItems && widget.__reScheduleItems.length) return Promise.resolve(widget.__reScheduleItems);
      if (widget.__reScheduleItemsPromise) return widget.__reScheduleItemsPromise;
      widget.__reScheduleItemsPromise = loadProgramsForWidget(widget).then(function (items) {
        widget.__reScheduleItems = items;
        widget.__reScheduleItemsPromise = null;
        return items;
      }, function () {
        widget.__reScheduleItems = parseScheduleItemsFromWidgetFallback(widget);
        widget.__reScheduleItemsPromise = null;
        return widget.__reScheduleItems;
      });
      return widget.__reScheduleItemsPromise;
    }

    function renderFullWidget(widget, items) {
      var now = currentClockContext(widget);
      var current = findProgram(items, now);
      var layout = parseScheduleLayout(widget);
      var titleEl = widget.querySelector('.re-schedule-title');
      var hostEl = widget.querySelector('.re-schedule-host');
      var timeEl = widget.querySelector('.re-schedule-time');
      var photoFrame = widget.querySelector('.re-schedule-photo-frame');
      var imageEl = widget.querySelector('.re-schedule-image');
      if (photoFrame) {
        photoFrame.style.left = layout.photoFrameX + 'px';
        photoFrame.style.top = layout.photoFrameY + 'px';
        photoFrame.style.width = layout.photoFrameW + 'px';
        photoFrame.style.height = layout.photoFrameH + 'px';
      }
      if (titleEl) { titleEl.style.left = layout.titleX + 'px'; titleEl.style.top = layout.titleY + 'px'; }
      if (hostEl) { hostEl.style.left = layout.hostX + 'px'; hostEl.style.top = layout.hostY + 'px'; }
      if (timeEl) { timeEl.style.left = layout.timeX + 'px'; timeEl.style.top = layout.timeY + 'px'; }
      if (!current) {
        if (titleEl) titleEl.textContent = 'Sem programação';
        if (hostEl) hostEl.textContent = '';
        if (timeEl) timeEl.textContent = '';
        if (imageEl) imageEl.style.display = 'none';
        return;
      }
      if (titleEl) titleEl.textContent = current.title || 'Programa';
      if (hostEl) hostEl.textContent = current.host || current.locutor || '';
      if (timeEl) timeEl.textContent = (current.start || '') + ' às ' + (current.end || '');
      if (imageEl) {
        if (current.image) {
          imageEl.src = current.image;
          imageEl.style.display = '';
          imageEl.style.transform = 'translate(' + Number(current.photoX || 0) + 'px, ' + Number(current.photoY || 0) + 'px) scale(' + Math.max(0.1, Number(current.photoZoom || 1)) + ')';
        } else {
          imageEl.style.display = 'none';
        }
      }
    }

    function renderPhotoWidget(widget, items) {
      var now = currentClockContext(widget);
      var current = findProgram(items, now);
      var imageEl = widget.querySelector('.re-current-program-photo');
      if (!imageEl) return;
      if (!current || !current.image) {
        imageEl.style.display = 'none';
        return;
      }
      imageEl.src = current.image;
      imageEl.style.display = '';
    }

    function renderVinylWidget(widget, items) {
      var now = currentClockContext(widget);
      var current = findProgram(items, now);
      var imageEl = widget.querySelector('.re-vinyl-image');
      if (!imageEl) return;
      var src = current && current.vinyl ? current.vinyl : DEFAULT_VINYL_PATH;
      if (imageEl.getAttribute('src') !== src) imageEl.setAttribute('src', src);
      imageEl.style.display = '';
    }

    function refreshSchedules() {
      allWidgets.forEach(function (widget) {
        primeClockForWidget(widget);
        ensureWidgetPrograms(widget).then(function (items) {
          if (fullWidgets.indexOf(widget) !== -1) renderFullWidget(widget, items || []);
          if (photoWidgets.indexOf(widget) !== -1) renderPhotoWidget(widget, items || []);
          if (vinylWidgets.indexOf(widget) !== -1) renderVinylWidget(widget, items || []);
        });
      });
    }

    if (!allWidgets.length) return;
    refreshSchedules();
    setInterval(refreshSchedules, 60 * 1000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindPlayers();
    bindResponsiveStage();
    bindThemeToggles();
    bindNewsWidgets();
    bindWeatherWidgets();
    bindImageLoops();
    bindSchedules();
  });
})();