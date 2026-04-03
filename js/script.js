// ===========================
// ELEMENTOS DO DOM
// ===========================

const radioStream = document.getElementById('radioStream');
const playBtn = document.getElementById('playBtn');
const muteBtn = document.getElementById('muteBtn');
const volumeSlider = document.getElementById('volumeSlider');
const themeToggle = document.getElementById('themeToggle');
const vinylWrapper = document.getElementById('vinylWrapper');
const vinylImage = vinylWrapper.querySelector('.vinyl-image');
const newsList = document.getElementById('newsList');
const weatherTemp = document.getElementById('weatherTemp');
const scheduleList = document.getElementById('scheduleList');

// Carousel
const carouselImg = document.getElementById('carouselImg');
const carouselDots = document.querySelectorAll('.dot');

const carouselImages = [
  'assets/uploads/1775229297225_2_rounded.png',
  'assets/uploads/1775229387960_3_rounded.png',
  'assets/uploads/1775229394475_1_rounded.png'
];

let currentCarouselIndex = 0;
let carouselInterval;

// ===========================
// PLAYER FUNCTIONALITY
// ===========================

// Play/Pause
playBtn.addEventListener('click', () => {
  if (radioStream.paused) {
    radioStream.play();
    playBtn.classList.add('playing');
    updatePlayButton();
    vinylImage.classList.add('playing');
  } else {
    radioStream.pause();
    playBtn.classList.remove('playing');
    updatePlayButton();
    vinylImage.classList.remove('playing');
  }
});

// Atualizar ícone do botão de play
function updatePlayButton() {
  const playIcon = playBtn.querySelector('.play-icon');
  const pauseIcon = playBtn.querySelector('.pause-icon');

  if (radioStream.paused) {
    playIcon.style.display = 'inline';
    pauseIcon.style.display = 'none';
  } else {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'inline';
  }
}

// Volume Control
volumeSlider.addEventListener('input', (e) => {
  radioStream.volume = e.target.value / 100;
  updateMuteButton();
});

// Mute Button
muteBtn.addEventListener('click', () => {
  if (radioStream.volume > 0) {
    radioStream.volume = 0;
    volumeSlider.value = 0;
  } else {
    radioStream.volume = 0.5;
    volumeSlider.value = 50;
  }
  updateMuteButton();
});

function updateMuteButton() {
  if (radioStream.volume === 0) {
    muteBtn.textContent = '🔇';
  } else if (radioStream.volume < 0.5) {
    muteBtn.textContent = '🔉';
  } else {
    muteBtn.textContent = '🔊';
  }
}

// ===========================
// THEME TOGGLE
// ===========================

// Verificar preferência salva
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  document.body.classList.add('dark-theme');
  updateThemeIcon();
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
});

function updateThemeIcon() {
  const isDark = document.body.classList.contains('dark-theme');
  themeToggle.querySelector('.theme-icon').textContent = isDark ? '☀️' : '🌙';
}

// ===========================
// CAROUSEL FUNCTIONALITY
// ===========================

function changeCarousel(index) {
  currentCarouselIndex = index;
  updateCarousel();
  resetCarouselInterval();
}

function updateCarousel() {
  carouselImg.style.opacity = '0';

  setTimeout(() => {
    carouselImg.src = carouselImages[currentCarouselIndex];
    carouselImg.style.opacity = '1';
  }, 250);

  // Atualizar dots
  carouselDots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentCarouselIndex);
  });
}

function nextCarousel() {
  currentCarouselIndex = (currentCarouselIndex + 1) % carouselImages.length;
  updateCarousel();
}

function resetCarouselInterval() {
  clearInterval(carouselInterval);
  carouselInterval = setInterval(nextCarousel, 8000);
}

// Iniciar carousel automático
resetCarouselInterval();

// ===========================
// NEWS FUNCTIONALITY
// ===========================

async function fetchNews() {
  try {
    const response = await fetch(
      'https://api.rss2json.com/v1/api.json?rss_url=https://g1.globo.com/rss/g1/'
    );
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      displayNews(data.items.slice(0, 8));
    } else {
      showNewsError();
    }
  } catch (error) {
    console.error('Erro ao carregar notícias:', error);
    showNewsError();
  }
}

function displayNews(items) {
  newsList.innerHTML = '';

  items.forEach((item) => {
    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';

    const title = item.title || 'Sem título';
    const pubDate = item.pubDate ? new Date(item.pubDate).toLocaleDateString('pt-BR') : '';
    const link = item.link || '#';

    newsItem.innerHTML = `
      <a href="${link}" target="_blank" rel="noopener">
        ${title}
      </a>
      ${pubDate ? `<div class="news-date">${pubDate}</div>` : ''}
    `;

    newsList.appendChild(newsItem);
  });
}

function showNewsError() {
  newsList.innerHTML = '<div class="news-loading">Erro ao carregar notícias</div>';
}

// Carregar notícias ao iniciar
fetchNews();

// Atualizar notícias a cada 15 minutos
setInterval(fetchNews, 15 * 60 * 1000);

// ===========================
// WEATHER FUNCTIONALITY
// ===========================

async function fetchWeather() {
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-22.9068&longitude=-43.1729&current_weather=true&timezone=America/Sao_Paulo'
    );
    const data = await response.json();

    if (data.current_weather) {
      const temp = Math.round(data.current_weather.temperature * 10) / 10;
      weatherTemp.textContent = `${temp}°C`;
    }
  } catch (error) {
    console.error('Erro ao carregar clima:', error);
    weatherTemp.textContent = 'N/A';
  }
}

// Carregar clima ao iniciar
fetchWeather();

// Atualizar clima a cada 30 minutos
setInterval(fetchWeather, 30 * 60 * 1000);

// ===========================
// SCHEDULE FUNCTIONALITY
// ===========================

const scheduleData = [
  {
    time: '09:00 - 10:59',
    name: 'Top Hits 1º Edição'
  },
  {
    time: '11:00 - 12:59',
    name: 'Uma Hora de Musicais'
  },
  {
    time: '13:00 - 15:59',
    name: 'Top Hits'
  },
  {
    time: '16:00 - 17:59',
    name: 'Top Hits 2º Edição'
  },
  {
    time: '18:00 - 18:59',
    name: 'Clube do Charme'
  },
  {
    time: '19:00 - 19:59',
    name: 'A Voz do Brasil'
  },
  {
    time: '20:00 - 08:59',
    name: 'Uma Hora de Músicas'
  }
];

function highlightCurrentSchedule() {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  scheduleList.querySelectorAll('.schedule-item').forEach((item, index) => {
    const schedule = scheduleData[index];
    const [startStr, endStr] = schedule.time.split(' - ');
    const [startHour, startMin] = startStr.split(':').map(Number);
    const [endHour, endMin] = endStr.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    let endTime = endHour * 60 + endMin;

    // Se o horário final é menor que o inicial, significa que passa da meia-noite
    if (endTime < startTime) {
      endTime += 24 * 60;
    }

    if (currentTime >= startTime && currentTime < endTime) {
      item.style.opacity = '1';
      item.style.transform = 'scale(1.02)';
    } else {
      item.style.opacity = '0.6';
    }
  });
}

// Atualizar programação ao iniciar
highlightCurrentSchedule();

// Atualizar programação a cada minuto
setInterval(highlightCurrentSchedule, 60 * 1000);

// ===========================
// INICIALIZAÇÃO
// ===========================

// Inicializar volume
radioStream.volume = 1;
updateMuteButton();
updatePlayButton();

// Log de inicialização
console.log('🎙️ Rádio Atividade - Página carregada com sucesso!');
