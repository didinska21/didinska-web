/* ==========================================
   MAIN.JS - JavaScript Utama
   ========================================== */

// Update tahun di footer secara otomatis
document.addEventListener('DOMContentLoaded', function() {
  const yearElement = document.getElementById('year');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // Animasi scroll reveal untuk elemen
  initScrollReveal();
  
  // Progress bar animation untuk skill
  initSkillProgress();
  
  // Copy to clipboard functionality
  initCopyButtons();
  
  // Smooth scroll untuk anchor links
  initSmoothScroll();
});

// Animasi reveal saat scroll
function initScrollReveal() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe semua card dan section
  const elementsToObserve = document.querySelectorAll('.card, .social-card, .airdrop-item, .skill-item, .donation-card');
  
  elementsToObserve.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `all 0.6s ease ${index * 0.1}s`;
    observer.observe(el);
  });
}

// Animasi progress bar untuk skill
function initSkillProgress() {
  const progressBars = document.querySelectorAll('.progress-fill');
  
  if (progressBars.length === 0) return;

  const observerOptions = {
    threshold: 0.5
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const progressFill = entry.target;
        const targetWidth = progressFill.getAttribute('data-progress');
        
        // Animasi dari 0 ke target width
        setTimeout(() => {
          progressFill.style.width = targetWidth + '%';
        }, 100);
        
        observer.unobserve(progressFill);
      }
    });
  }, observerOptions);

  progressBars.forEach(bar => {
    bar.style.width = '0%';
    observer.observe(bar);
  });
}

// Copy to clipboard functionality
function initCopyButtons() {
  const copyButtons = document.querySelectorAll('.copy-button');
  
  copyButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetId = this.getAttribute('data-copy-target');
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        const textToCopy = targetElement.textContent || targetElement.value;
        
        // Copy menggunakan Clipboard API
        navigator.clipboard.writeText(textToCopy).then(() => {
          // Tampilkan feedback
          const originalText = this.textContent;
          this.textContent = '✓ Tersalin!';
          this.classList.add('copied');
          
          setTimeout(() => {
            this.textContent = originalText;
            this.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('Gagal menyalin:', err);
          alert('Gagal menyalin teks');
        });
      }
    });
  });
}

// Smooth scroll untuk anchor links
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      
      // Jangan smooth scroll untuk href="#" saja
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Helper: Format angka dengan pemisah ribuan
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Helper: Animate counter untuk statistik
function animateCounter(element, start, end, duration) {
  const range = end - start;
  const increment = range / (duration / 16); // 60 FPS
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= end) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = Math.floor(current);
  }, 16);
}

// Counter animation untuk stat numbers
document.addEventListener('DOMContentLoaded', function() {
  const statNumbers = document.querySelectorAll('.stat-number');
  
  if (statNumbers.length > 0) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = entry.target;
          const endValue = parseInt(target.textContent);
          target.textContent = '0';
          animateCounter(target, 0, endValue, 2000);
          observer.unobserve(target);
        }
      });
    }, { threshold: 0.5 });
    
    statNumbers.forEach(stat => observer.observe(stat));
  }
});

// Mobile menu toggle (jika nanti ditambahkan hamburger menu)
function toggleMobileMenu() {
  const nav = document.querySelector('.main-nav');
  nav.classList.toggle('active');
}

// Fungsi untuk menambahkan class 'scrolled' ke header saat scroll
window.addEventListener('scroll', function() {
  const header = document.querySelector('.site-header');
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// Easter egg: Konami code
let konamiCode = [];
const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

document.addEventListener('keydown', function(e) {
  konamiCode.push(e.key);
  konamiCode = konamiCode.slice(-10);
  
  if (konamiCode.join(',') === konamiSequence.join(',')) {
    activateEasterEgg();
  }
});

function activateEasterEgg() {
  document.body.style.animation = 'rainbow 2s linear infinite';
  setTimeout(() => {
    document.body.style.animation = '';
  }, 5000);
}

// Console message untuk developer
console.log('%c👋 Halo Developer!', 'font-size: 20px; color: #00aeef; font-weight: bold;');
console.log('%cTerima kasih sudah mampir ke website ini!', 'font-size: 14px; color: #a0aec0;');
console.log('%cDibuat dengan ❤️ menggunakan HTML, CSS & JavaScript', 'font-size: 12px; color: #a0aec0;');
