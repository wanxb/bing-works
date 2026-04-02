// 移动端卡片轮播功能（仅大图标视图使用）
let mobileCarousel = null;
import { renderFilteredWorks } from './data.js';
import { getActiveFilter } from './filters.js';

class MobileCarousel {
  constructor(catalog) {
    this.catalog = catalog;
    this.cards = [];
    this.currentIndex = 0;
    this.isDragging = false;
    this.startX = 0;
    this.currentX = 0;
    this.track = null;
    this.pagination = null;
    this.slideWidth = 0;
    this.keydownHandler = null;
    this.init();
  }

  init() {
    if (window.innerWidth > 720) return;
    if (this.catalog.dataset.view !== 'large') return;

    this.cards = Array.from(this.catalog.querySelectorAll('.card:not([style*="display: none"])'));
    if (this.cards.length <= 1) return;

    this.createCarousel();
    this.initPagination();
    this.initSwipe();
    this.initKeyboardNav();
    this.showSwipeHint();

    this.catalog.classList.add('mobile-carousel-enabled');

    this.resizeHandler = () => {
      if (window.innerWidth <= 720 && this.catalog.dataset.view === 'large') {
        if (!this.track) this.createCarousel();
        if (!this.pagination) this.initPagination();
        this.updateTrack();
      } else {
        this.destroy();
      }
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  createCarousel() {
    this.track = document.createElement('div');
    this.track.className = 'mobile-carousel-track';

    this.cards.forEach((card, index) => {
      const slide = document.createElement('div');
      slide.className = 'mobile-carousel-slide';

      if (index === 0) {
        card.classList.add('active');
      }

      slide.appendChild(card);
      this.track.appendChild(slide);
    });

    this.carousel = document.createElement('div');
    this.carousel.className = 'mobile-carousel';
    this.carousel.appendChild(this.track);
    this.catalog.appendChild(this.carousel);
  }

  initPagination() {
    this.pagination = document.createElement('div');
    this.pagination.className = 'mobile-pagination';

    this.cards.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.className = 'mobile-pagination-dot' + (index === 0 ? ' active' : '');
      dot.addEventListener('click', () => this.goToSlide(index));
      this.pagination.appendChild(dot);
    });

    this.catalog.appendChild(this.pagination);
  }

  updateTrack() {
    if (!this.track || !this.carousel) return;

    const slides = this.track.querySelectorAll('.mobile-carousel-slide');
    this.slideWidth = this.carousel.offsetWidth;

    let translateOffset = 0;
    let visibleCount = 0;
    for (const slide of slides) {
      if (slide.style.display !== 'none') {
        if (visibleCount < this.currentIndex) {
          translateOffset += this.slideWidth;
        } else {
          break;
        }
        visibleCount++;
      }
    }

    this.track.style.transform = `translateX(-${translateOffset}px)`;
  }

  goToSlide(index) {
    if (!this.track || !this.pagination) return;

    const slides = this.track.querySelectorAll('.mobile-carousel-slide');
    const visibleSlides = Array.from(slides).filter(slide => slide.style.display !== 'none');
    if (index < 0 || index >= visibleSlides.length) return;

    const currentSlide = visibleSlides[this.currentIndex];
    const nextSlide = visibleSlides[index];
    const currentCard = currentSlide?.querySelector('.card');
    const nextCard = nextSlide?.querySelector('.card');

    if (currentCard) currentCard.classList.remove('active');
    if (nextCard) nextCard.classList.add('active');

    const dots = this.pagination.querySelectorAll('.mobile-pagination-dot');
    if (dots[this.currentIndex]) dots[this.currentIndex].classList.remove('active');
    if (dots[index]) dots[index].classList.add('active');

    this.currentIndex = index;
    this.updateTrack();
  }

  initSwipe() {
    if (!this.carousel || !this.track) return;

    let startTime = 0;
    let isSwipe = false;

    const handleStart = (x) => {
      if (window.innerWidth > 720) return;
      this.isDragging = true;
      this.startX = x;
      this.currentX = x;
      startTime = Date.now();
      isSwipe = false;
      this.track.style.transition = 'none';
    };

    const handleMove = (x) => {
      if (!this.isDragging || !this.track) return;
      this.currentX = x;
      const diff = this.currentX - this.startX;

      if (Math.abs(diff) > 10) {
        isSwipe = true;
      }

      this.track.style.transform = `translateX(${-this.currentIndex * this.slideWidth + diff}px)`;
    };

    const handleEnd = () => {
      if (!this.isDragging || !this.track) return;
      this.isDragging = false;

      const diff = this.currentX - this.startX;
      const deltaTime = Date.now() - startTime;
      const velocity = Math.abs(diff) / deltaTime;

      this.track.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

      const slides = this.track.querySelectorAll('.mobile-carousel-slide');
      const visibleSlides = Array.from(slides).filter(slide => slide.style.display !== 'none');
      const maxIndex = visibleSlides.length - 1;

      if (isSwipe && (Math.abs(diff) > 50 || velocity > 0.5)) {
        if (diff > 0 && this.currentIndex > 0) {
          this.goToSlide(this.currentIndex - 1);
        } else if (diff < 0 && this.currentIndex < maxIndex) {
          this.goToSlide(this.currentIndex + 1);
        } else {
          this.updateTrack();
        }
      } else {
        this.updateTrack();
      }
    };

    this.carousel.addEventListener('touchstart', (e) => {
      handleStart(e.touches[0].clientX);
    }, { passive: true });

    this.carousel.addEventListener('touchmove', (e) => {
      handleMove(e.touches[0].clientX);
    }, { passive: true });

    this.carousel.addEventListener('touchend', handleEnd);
    this.carousel.addEventListener('touchcancel', handleEnd);

    this.carousel.addEventListener('mousedown', (e) => {
      handleStart(e.clientX);
    });

    this.carousel.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        e.preventDefault();
        handleMove(e.clientX);
      }
    });

    this.carousel.addEventListener('mouseup', handleEnd);
    this.carousel.addEventListener('mouseleave', handleEnd);
  }

  initKeyboardNav() {
    this.keydownHandler = (e) => {
      if (!this.track || !this.pagination) return;
      if (window.innerWidth > 720) return;

      const slides = this.track.querySelectorAll('.mobile-carousel-slide');
      const visibleSlides = Array.from(slides).filter(slide => slide.style.display !== 'none');
      const maxIndex = visibleSlides.length - 1;

      if (e.key === 'ArrowLeft' && this.currentIndex > 0) {
        e.preventDefault();
        this.goToSlide(this.currentIndex - 1);
      } else if (e.key === 'ArrowRight' && this.currentIndex < maxIndex) {
        e.preventDefault();
        this.goToSlide(this.currentIndex + 1);
      }
    };

    document.addEventListener('keydown', this.keydownHandler);
  }

  showSwipeHint() {
    const hasSeenHint = localStorage.getItem('bing-works-swipe-hint');
    if (hasSeenHint) return;

    const hint = document.createElement('div');
    hint.className = 'mobile-swipe-hint';
    hint.innerHTML = `
      <div class="swipe-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
      <span>左右滑动查看更多</span>
    `;

    document.body.appendChild(hint);
    localStorage.setItem('bing-works-swipe-hint', 'true');

    setTimeout(() => {
      hint.remove();
    }, 3000);
  }

  destroy(options = {}) {
    const { restoreCards = true } = options;

    if (this.catalog && this.carousel) {
      if (restoreCards && this.catalog.contains(this.carousel) && this.track) {
        const slides = this.track.querySelectorAll('.mobile-carousel-slide');
        slides.forEach(slide => {
          const card = slide.querySelector('.card');
          if (card) {
            card.classList.remove('active');
            this.catalog.appendChild(card);
          }
        });
      }

      this.carousel.remove();
      if (this.pagination) this.pagination.remove();
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
    this.track = null;
    this.pagination = null;
    this.carousel = null;
    this.resizeHandler = null;
    this.keydownHandler = null;
    this.cards = [];
    this.currentIndex = 0;
    if (this.catalog) this.catalog.classList.remove('mobile-carousel-enabled');
  }
}

document.addEventListener('dataLoaded', () => {
  const catalog = document.getElementById('catalog');
  if (catalog && window.innerWidth <= 720 && catalog.dataset.view === 'large') {
    mobileCarousel = new MobileCarousel(catalog);
  }
});

document.addEventListener('worksRendered', () => {
  const catalog = document.getElementById('catalog');

  if (window.innerWidth <= 720 && catalog && catalog.dataset.view === 'large') {
    if (mobileCarousel) {
      mobileCarousel.destroy();
      mobileCarousel = null;
    }

    setTimeout(() => {
      mobileCarousel = new MobileCarousel(catalog);
    }, 10);
  } else if (mobileCarousel) {
    mobileCarousel.destroy();
    mobileCarousel = null;
  }
});

document.addEventListener('filterChanged', () => {
  if (mobileCarousel) {
    mobileCarousel.destroy({ restoreCards: false });
    mobileCarousel = null;
  }
});

document.addEventListener('viewChanged', (e) => {
  const { view } = e.detail;
  const catalog = document.getElementById('catalog');

  if (window.innerWidth <= 720) {
    if (view === 'large') {
      if (mobileCarousel) {
        mobileCarousel.destroy();
        mobileCarousel = null;
      }

      const activeFilter = getActiveFilter();
      if (activeFilter) {
        renderFilteredWorks(activeFilter);
      }
    } else {
      if (mobileCarousel) {
        mobileCarousel.destroy();
        mobileCarousel = null;
      }

      const cards = document.querySelectorAll('.card');
      cards.forEach(card => {
        card.style.display = '';
      });

      const activeFilter = getActiveFilter();
      if (activeFilter) {
        cards.forEach(card => {
          const tags = card.dataset.tags.split(' ');
          const matched = activeFilter === 'all' || tags.includes(activeFilter);
          card.style.display = matched ? '' : 'none';
        });
      }
    }
  }
});
