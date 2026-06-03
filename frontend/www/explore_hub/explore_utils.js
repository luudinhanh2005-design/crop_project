// explore_utils.js
// Các hàm tiện ích dùng chung cho hệ thống Khám phá nông nghiệp
window.AgriExplore = window.AgriExplore || {};

window.AgriExplore.debounce = function(fn, delay) {
    let timeout = null;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
};

window.AgriExplore.Formatter = {
    formatViews: function(num) {
        if (!num) return '0';
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toLocaleString();
    },
    
    getDifficultyBadgeClass: function(difficulty) {
        const diff = String(difficulty || '').toLowerCase();
        if (diff.includes('dễ') || diff.includes('easy')) {
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        }
        if (diff.includes('trung') || diff.includes('medium')) {
            return 'bg-amber-100 text-amber-800 border-amber-200';
        }
        return 'bg-rose-100 text-rose-800 border-rose-200';
    }
};

window.AgriExplore.Animator = {
    fadeIn: function(element, duration = 300) {
        if (!element) return;
        element.style.opacity = '0';
        element.classList.remove('hidden');
        element.style.display = 'flex';
        element.animate([
            { opacity: 0, transform: 'scale(0.95)' },
            { opacity: 1, transform: 'scale(1)' }
        ], {
            duration: duration,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            fill: 'forwards'
        });
    },
    
    fadeOut: function(element, duration = 250) {
        if (!element) return;
        const anim = element.animate([
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.95)' }
        ], {
            duration: duration,
            easing: 'ease-in-out',
            fill: 'forwards'
        });
        anim.onfinish = () => {
            element.style.display = 'none';
            element.classList.add('hidden');
        };
    },
    
    animateProgressBar: function(barElement, targetValue, duration = 800) {
        if (!barElement) return;
        barElement.style.width = '0%';
        setTimeout(() => {
            barElement.animate([
                { width: '0%' },
                { width: targetValue + '%' }
            ], {
                duration: duration,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'forwards'
            });
        }, 100);
    }
};
