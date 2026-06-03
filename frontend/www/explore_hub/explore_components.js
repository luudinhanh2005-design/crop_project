// explore_components.js
// Các component UI chính cho Explore Hub - Production Version
window.AgriExplore = window.AgriExplore || {};

(function() {
    const { searchService, cropService, newsService, calendarService, mapService, weatherService, Formatter, Animator } = window.AgriExplore;

    // State quản lý cục bộ
    let heroNewsList = [];
    let currentHeroIndex = 0;
    let heroInterval = null;
    let scCurrentRegion = 'Bắc';

    // Helper: Tạo Skeleton loading cho Carousel
    function showHeroSkeleton() {
        const card = document.getElementById('explore-hero-card');
        if (!card) return;
        card.innerHTML = `
            <div class="absolute inset-0 bg-neutral-200 animate-pulse flex flex-col justify-end p-8 gap-3">
                <div class="h-4 bg-neutral-300 w-24 rounded-full"></div>
                <div class="h-8 bg-neutral-300 w-2/3 rounded-md"></div>
                <div class="h-4 bg-neutral-300 w-1/2 rounded-md"></div>
                <div class="flex gap-4 mt-4">
                    <div class="h-10 bg-neutral-300 w-32 rounded-xl"></div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 1. COMPONENT: CAROUSEL HERO NEWS
    // ==========================================
    class HeroNewsSlider {
        constructor() {
            this.card = document.getElementById('explore-hero-card');
            if (this.card) this.init();
        }

        async init() {
            showHeroSkeleton();
            heroNewsList = await newsService.getHeroNews();
            if (heroNewsList.length === 0) {
                // Fallback nếu rỗng
                heroNewsList = [{
                    id: "hn_fb",
                    title: "Chào mừng bạn đến với Explore Hub",
                    summary: "Công nghệ AI nhận diện dịch bệnh và khuyến nghị canh tác tiên tiến hàng đầu.",
                    image_url: "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1200",
                    badge: "GIỚI THIỆU",
                    color: "primary"
                }];
            }
            
            currentHeroIndex = 0;
            this.render();
            this.startAutoplay();
            this.setupHoverHandlers();
        }

        render() {
            if (!this.card || heroNewsList.length === 0) return;
            const item = heroNewsList[currentHeroIndex];
            
            // Prefetch ảnh tiếp theo để trượt mượt mà
            const nextIdx = (currentHeroIndex + 1) % heroNewsList.length;
            const nextItem = heroNewsList[nextIdx];
            if (nextItem && nextItem.image_url) {
                const imgPrefetch = new Image();
                imgPrefetch.src = nextItem.image_url;
            }

            this.card.innerHTML = `
                <div class="h-full w-full absolute inset-0 transition-all duration-500 transform scale-100">
                    <img id="exp-hero-img" alt="Plant of the day" class="w-full h-full object-cover transition-opacity duration-300"
                        src="${item.image_url || 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1200&q=80'}" 
                        onerror="if(!this.dataset.failed){ this.dataset.failed=true; this.src='https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=1200'; }"
                        loading="eager" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent"></div>
                </div>
                <div class="relative p-8 mt-auto flex flex-col gap-3 text-white z-10 animate-fade-in">
                    <div id="exp-hero-badge"
                        class="w-fit bg-${item.color || 'primary'} text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm border border-white/20 uppercase tracking-widest">
                        <span class="material-symbols-outlined text-[14px]">bolt</span>
                        ${item.badge || 'TIN NÓNG'}
                    </div>
                    <h2 id="exp-hero-title" class="text-3xl md:text-4xl font-black drop-shadow-md leading-tight max-w-2xl">
                        ${item.title}
                    </h2>
                    <p id="exp-hero-desc" class="text-white/90 drop-shadow max-w-lg line-clamp-2 text-sm font-medium">
                        ${item.summary}
                    </p>
                    <div class="flex items-center gap-4 mt-4">
                        <button id="btn-hero-read" onclick="window.openNewsArticle ? window.openNewsArticle('${item.id}') : window.showToast('Đang mở bài viết...', 'info')"
                            class="bg-white text-neutral-900 px-8 py-3 rounded-xl font-bold hover:bg-white/90 transition-all flex items-center gap-2 shadow-xl active:scale-95 text-xs uppercase tracking-wider">
                            Đọc ngay
                            <span class="material-symbols-outlined text-[18px]">menu_book</span>
                        </button>
                        <div class="flex gap-2 ml-auto">
                            <button onclick="window.prevHeroNews()"
                                class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all active:scale-90">
                                <span class="material-symbols-outlined">chevron_left</span>
                            </button>
                            <button onclick="window.nextHeroNews()"
                                class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all active:scale-90">
                                <span class="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div id="hero-indicators" class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    ${heroNewsList.slice(0, 5).map((_, i) => `
                        <div class="h-1.5 rounded-full transition-all duration-300 ${i === currentHeroIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}"></div>
                    `).join('')}
                </div>
            `;
        }

        startAutoplay() {
            this.stopAutoplay();
            heroInterval = setInterval(() => this.next(), 6000);
        }

        stopAutoplay() {
            if (heroInterval) {
                clearInterval(heroInterval);
                heroInterval = null;
            }
        }

        next() {
            if (heroNewsList.length === 0) return;
            currentHeroIndex = (currentHeroIndex + 1) % heroNewsList.length;
            this.render();
        }

        prev() {
            if (heroNewsList.length === 0) return;
            currentHeroIndex = (currentHeroIndex - 1 + heroNewsList.length) % heroNewsList.length;
            this.render();
        }

        setupHoverHandlers() {
            if (!this.card) return;
            this.card.addEventListener('mouseenter', () => this.stopAutoplay());
            this.card.addEventListener('mouseleave', () => this.startAutoplay());
        }
    }

    // ==========================================
    // 2. COMPONENT: SMART HEADER SEARCH
    // ==========================================
    class SearchDropdown {
        constructor() {
            this.input = document.querySelector('.cs-search-bar input');
            this.dropdown = document.getElementById('search-results-dropdown');
            this.historyKey = 'agrisocial_search_history';
            this.currentIndex = -1;
            this.results = [];
            this.currentPage = 1;
            this.hasMore = true;
            this.isLoading = false;
            
            if (this.input && this.dropdown) {
                this.init();
            }
        }

        init() {
            const handleInput = window.AgriExplore.debounce(async (val) => {
                this.currentPage = 1;
                await this.performSearch(val);
            }, 250);

            this.input.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (val.length === 0) {
                    this.renderHistoryAndTrending();
                    return;
                }
                handleInput(val);
            });

            this.input.addEventListener('focus', () => {
                if (this.input.value.trim().length === 0) {
                    this.renderHistoryAndTrending();
                } else {
                    this.dropdown.classList.remove('hidden');
                }
            });

            // Click outside close
            document.addEventListener('click', (e) => {
                if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                    this.dropdown.classList.add('hidden');
                }
            });

            // Keyboard navigation
            this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
            
            // Xử lý cuộn vô hạn để tải thêm kết quả
            this.dropdown.addEventListener('scroll', () => {
                if (this.dropdown.scrollTop + this.dropdown.clientHeight >= this.dropdown.scrollHeight - 20) {
                    this.loadMore();
                }
            });
        }

        async performSearch(query) {
            this.isLoading = true;
            this.dropdown.innerHTML = `
                <div class="p-6 text-center text-xs text-on-surface-variant font-medium flex items-center justify-center gap-2">
                    <div class="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    Đang tìm dữ liệu...
                </div>
            `;
            this.dropdown.classList.remove('hidden');

            try {
                const results = await searchService.search(query, this.currentPage);
                if (results === null) return;
                this.results = results;
                this.currentIndex = -1;
                this.hasMore = results.length >= 10;
                this.renderResults(query);
            } catch (err) {
                this.dropdown.innerHTML = `<div class="p-4 text-center text-xs text-red-500">Lỗi kết nối. Vui lòng thử lại.</div>`;
            } finally {
                this.isLoading = false;
            }
        }

        async loadMore() {
            if (this.isLoading || !this.hasMore) return;
            const query = this.input.value.trim();
            if (!query) return;

            this.isLoading = true;
            this.currentPage++;
            
            // Thêm chỉ báo loading xuống cuối dropdown
            const loadIndicator = document.createElement('div');
            loadIndicator.className = "p-2 text-center text-[10px] text-on-surface-variant font-bold";
            loadIndicator.innerText = "Đang tải thêm...";
            this.dropdown.appendChild(loadIndicator);

            try {
                const newResults = await searchService.search(query, this.currentPage);
                if (loadIndicator.parentNode) loadIndicator.parentNode.removeChild(loadIndicator);
                
                if (newResults && newResults.length > 0) {
                    this.results = this.results.concat(newResults);
                    this.hasMore = newResults.length >= 10;
                    this.renderResults(query);
                } else {
                    this.hasMore = false;
                }
            } catch (err) {
                if (loadIndicator.parentNode) loadIndicator.parentNode.removeChild(loadIndicator);
            } finally {
                this.isLoading = false;
            }
        }

        renderResults(query) {
            if (this.results.length === 0) {
                this.dropdown.innerHTML = `
                    <div class="p-6 text-center text-xs text-on-surface-variant font-medium">
                        <span class="material-symbols-outlined text-[32px] block opacity-40 mb-2">search_off</span>
                        Không tìm thấy kết quả phù hợp cho "${query}"
                    </div>
                `;
                return;
            }

            const crops = this.results.filter(r => r.type === 'crop');
            const experts = this.results.filter(r => r.type === 'user');
            const news = this.results.filter(r => r.type === 'news');

            let html = '';
            let globalIndex = 0;

            const makeItem = (item, action) => {
                const idx = globalIndex++;
                return `
                    <div data-search-index="${idx}" onclick="${action}; window.AgriExplore.searchDropdown.saveToHistory('${item.title}');"
                         class="search-item-row flex items-center gap-3 p-2.5 rounded-2xl hover:bg-primary/5 cursor-pointer transition-all">
                        <img src="${item.image_url}" onerror="if(!this.dataset.failed){ this.dataset.failed=true; this.src='https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=100'; }" 
                             class="w-10 h-10 rounded-xl object-cover border border-outline-variant/30 flex-shrink-0" loading="lazy">
                        <div class="overflow-hidden flex-1">
                            <div class="text-xs font-black text-on-surface truncate">${this.highlightKeyword(item.title, query)}</div>
                            <div class="text-[10px] font-medium text-on-surface-variant truncate">${item.subtitle}</div>
                        </div>
                    </div>
                `;
            };

            if (crops.length > 0) {
                html += `<div class="p-2"><h4 class="text-[10px] font-black text-primary uppercase tracking-wider px-3 py-1 flex items-center gap-1"><span class="material-symbols-outlined text-xs">eco</span> Cây trồng</h4>${crops.map(c => makeItem(c, `window.openCropDetails('${c.title}'); document.getElementById('search-results-dropdown').classList.add('hidden');`)).join('')}</div>`;
            }
            if (experts.length > 0) {
                html += `<div class="p-2 border-t border-outline-variant/30"><h4 class="text-[10px] font-black text-secondary uppercase tracking-wider px-3 py-1 flex items-center gap-1"><span class="material-symbols-outlined text-xs">support_agent</span> Chuyên gia</h4>${experts.map(e => makeItem(e, `window.switchTab('page-expert'); document.getElementById('search-results-dropdown').classList.add('hidden');`)).join('')}</div>`;
            }
            if (news.length > 0) {
                html += `<div class="p-2 border-t border-outline-variant/30"><h4 class="text-[10px] font-black text-amber-600 uppercase tracking-wider px-3 py-1 flex items-center gap-1"><span class="material-symbols-outlined text-xs">newspaper</span> Tin tức</h4>${news.map(n => makeItem(n, `window.openNewsArticle('${n.id}'); document.getElementById('search-results-dropdown').classList.add('hidden');`)).join('')}</div>`;
            }
            this.dropdown.innerHTML = html;
        }

        highlightKeyword(text, keyword) {
            if (!keyword) return text;
            const regex = new RegExp(`(${keyword})`, 'gi');
            return text.replace(regex, '<mark class="bg-amber-100 text-on-surface font-black px-0.5 rounded">$1</mark>');
        }

        renderHistoryAndTrending() {
            const history = this.getHistory();
            const trending = ['Lúa hè thu', 'Sầu riêng Ri6', 'Thủy canh cà chua', 'Sâu keo', 'Phân hữu cơ'];
            let html = '';
            if (history.length > 0) {
                html += `
                    <div class="p-3">
                        <div class="flex justify-between items-center px-2 py-1">
                            <span class="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">Lịch sử</span>
                            <button onclick="window.AgriExplore.searchDropdown.clearHistory()" class="text-[9px] font-black text-red-500 hover:underline">XÓA TẤT CẢ</button>
                        </div>
                        <div class="flex flex-wrap gap-2 mt-2 px-2">
                            ${history.map(h => `<span onclick="window.AgriExplore.searchDropdown.useHistoryKeyword('${h}')" class="bg-surface-container-low border border-outline-variant/30 rounded-full px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-primary/5 cursor-pointer flex items-center gap-1"><span class="material-symbols-outlined text-[12px] opacity-60">history</span> ${h}</span>`).join('')}
                        </div>
                    </div>
                `;
            }
            html += `
                <div class="p-3 border-t border-outline-variant/30">
                    <span class="text-[10px] font-black text-primary uppercase tracking-wider px-2 block">Từ khóa nổi bật 🔥</span>
                    <div class="flex flex-wrap gap-2 mt-2 px-2">
                        ${trending.map(t => `<span onclick="window.AgriExplore.searchDropdown.useHistoryKeyword('${t}')" class="bg-primary/5 border border-primary/10 rounded-full px-3 py-1.5 text-xs font-black text-primary hover:bg-primary/10 cursor-pointer flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">trending_up</span> ${t}</span>`).join('')}
                    </div>
                </div>
            `;
            this.dropdown.innerHTML = html;
            this.dropdown.classList.remove('hidden');
        }

        getHistory() {
            try { return JSON.parse(localStorage.getItem(this.historyKey)) || []; } catch { return []; }
        }

        saveToHistory(keyword) {
            if (!keyword) return;
            let history = this.getHistory().filter(h => h !== keyword);
            history.unshift(keyword);
            localStorage.setItem(this.historyKey, JSON.stringify(history.slice(0, 5)));
        }

        clearHistory() {
            localStorage.removeItem(this.historyKey);
            this.renderHistoryAndTrending();
        }

        useHistoryKeyword(keyword) {
            this.input.value = keyword;
            this.performSearch(keyword);
        }

        handleKeydown(e) {
            const items = this.dropdown.querySelectorAll('.search-item-row');
            if (items.length === 0) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.currentIndex = (this.currentIndex + 1) % items.length;
                this.highlightItem(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.currentIndex = (this.currentIndex - 1 + items.length) % items.length;
                this.highlightItem(items);
            } else if (e.key === 'Enter') {
                if (this.currentIndex >= 0) {
                    e.preventDefault();
                    items[this.currentIndex].click();
                }
            } else if (e.key === 'Escape') {
                this.dropdown.classList.add('hidden');
                this.input.blur();
            }
        }

        highlightItem(items) {
            items.forEach((item, idx) => {
                if (idx === this.currentIndex) {
                    item.classList.add('bg-primary/10', 'scale-[1.01]');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('bg-primary/10', 'scale-[1.01]');
                }
            });
        }
    }

    // ==========================================
    // 3. COMPONENT: CROP INTELLIGENCE PANEL
    // ==========================================
    class CropModal {
        constructor() {
            this.modal = document.getElementById('crop-detail-modal');
            this.activeTab = 'overview';
            this.currentCropData = null;
            this.setupEscapeListener();
        }

        setupEscapeListener() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
                    this.close();
                }
            });
        }

        async open(cropName) {
            try {
                this.modal.innerHTML = `
                    <div class="bg-surface w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col justify-center items-center p-12 border border-outline-variant">
                        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p class="text-xs text-on-surface-variant font-bold">Đang tổng hợp thông tin cây trồng bằng AI...</p>
                    </div>
                `;
                Animator.fadeIn(this.modal);
                document.body.style.overflow = 'hidden'; // Lock scroll

                const data = await cropService.getCropDetails(cropName);
                this.currentCropData = data;
                this.renderModalLayout(data);
                this.switchTab('overview');
            } catch (err) {
                window.showToast ? window.showToast("Không thể tải thông tin cây trồng", "error") : alert("Không thể tải dữ liệu cây trồng");
                this.close();
            }
        }

        close() {
            Animator.fadeOut(this.modal);
            document.body.style.overflow = ''; // Unlock scroll
            // Cập nhật lại cây trồng xu hướng khi đóng modal (lượt xem tăng lên)
            setTimeout(() => {
                if (window.renderTrendingCrops) window.renderTrendingCrops();
            }, 500);
        }

        renderModalLayout(data) {
            const hasGallery = data.gallery && data.gallery.length > 0;
            const heroImg = hasGallery ? data.gallery[0] : 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=800';

            this.modal.innerHTML = `
                <div class="bg-surface w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] border border-outline-variant animate-fade-in" onclick="event.stopPropagation()">
                    <!-- Hero Banner -->
                    <div class="h-56 relative w-full flex-shrink-0">
                        <img id="cd-crop-img" class="w-full h-full object-cover" src="${heroImg}" onerror="if(!this.dataset.failed){ this.dataset.failed=true; this.src='https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=800'; }" alt="Crop image">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"></div>
                        <button onclick="window.AgriExplore.cropModal.close()" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-all border border-white/10 active:scale-90 z-20">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                        <div class="absolute bottom-4 left-6 text-white z-10">
                            <span class="text-xs font-bold text-primary-container bg-primary/80 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md uppercase tracking-wider">${data.ten_khoa_hoc || 'BOTANICAL'}</span>
                            <h2 class="text-2xl font-black mt-2 drop-shadow-md">${data.vi || 'Tên Cây'}</h2>
                        </div>
                    </div>

                    <!-- Navigation Tabs -->
                    <div class="bg-surface-container-low border-b border-outline-variant/30 flex justify-around p-1 flex-shrink-0 z-10">
                        ${[
                            { id: 'overview', label: 'Tổng quan', icon: 'menu_book' },
                            { id: 'conditions', label: 'Điều kiện', icon: 'thermostat' },
                            { id: 'diseases', label: 'Sâu bệnh', icon: 'coronavirus' },
                            { id: 'growth', label: 'Mùa vụ', icon: 'timeline' },
                            { id: 'ai', label: 'AI Insight', icon: 'psychology' }
                        ].map(t => `
                            <button id="cm-tab-${t.id}" onclick="window.AgriExplore.cropModal.switchTab('${t.id}')"
                                    class="flex flex-col items-center gap-1 py-2 px-3 text-[10px] font-black text-on-surface-variant hover:text-primary transition-all relative w-1/5">
                                <span class="material-symbols-outlined text-lg">${t.icon}</span>
                                <span>${t.label}</span>
                                <div class="tab-indicator absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full transition-opacity opacity-0"></div>
                            </button>
                        `).join('')}
                    </div>

                    <!-- Modal Body -->
                    <div class="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 no-scrollbar" id="cm-content-body"></div>
                </div>
            `;
        }

        switchTab(tabId) {
            this.activeTab = tabId;
            const tabs = ['overview', 'conditions', 'diseases', 'growth', 'ai'];
            tabs.forEach(t => {
                const btn = document.getElementById(`cm-tab-${t}`);
                if (btn) {
                    const indicator = btn.querySelector('.tab-indicator');
                    if (t === tabId) {
                        btn.classList.add('text-primary');
                        btn.classList.remove('text-on-surface-variant');
                        if (indicator) indicator.classList.remove('opacity-0');
                    } else {
                        btn.classList.remove('text-primary');
                        btn.classList.add('text-on-surface-variant');
                        if (indicator) indicator.classList.add('opacity-0');
                    }
                }
            });
            this.renderTabContent();
        }

        async renderTabContent() {
            const body = document.getElementById('cm-content-body');
            const data = this.currentCropData;
            if (!body || !data) return;

            body.innerHTML = '';

            if (this.activeTab === 'overview') {
                body.innerHTML = `
                    <div class="space-y-6 animate-fade-in">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30 text-xs">
                            <div><span class="text-on-surface-variant font-medium block">Tên khoa học</span><b class="text-on-surface text-[11px] block mt-0.5 truncate">${data.ten_khoa_hoc || '---'}</b></div>
                            <div><span class="text-on-surface-variant font-medium block">Bộ</span><b class="text-on-surface text-[11px] block mt-0.5 truncate">${data.bo || '---'}</b></div>
                            <div><span class="text-on-surface-variant font-medium block">Họ</span><b class="text-on-surface text-[11px] block mt-0.5 truncate">${data.ho || '---'}</b></div>
                            <div><span class="text-on-surface-variant font-medium block">Loài</span><b class="text-on-surface text-[11px] block mt-0.5 truncate">${data.loai || '---'}</b></div>
                        </div>
                        <div>
                            <h3 class="font-black text-sm text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">description</span> Mô tả giống cây</h3>
                            <p class="text-on-surface-variant font-medium text-xs leading-relaxed">${data.mo_ta || 'Chưa có mô tả chi tiết.'}</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20">
                                <span class="text-on-surface-variant text-[10px] font-black uppercase tracking-wider block">Thời vụ thu hoạch</span>
                                <b class="text-xs font-black text-primary block mt-1">${data.thuoc_tinh?.thoi_gian || '3 - 4 tháng'}</b>
                            </div>
                            <div class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20">
                                <span class="text-on-surface-variant text-[10px] font-black uppercase tracking-wider block">Môi trường phù hợp</span>
                                <b class="text-xs font-black text-primary block mt-1 truncate">${data.thuoc_tinh?.moi_truong || 'Khô ráo'}</b>
                            </div>
                        </div>
                    </div>
                `;
            } else if (this.activeTab === 'conditions') {
                body.innerHTML = `
                    <div class="space-y-6 animate-fade-in">
                        <h3 class="font-black text-sm text-primary uppercase tracking-widest flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">filter_vintage</span> Nhu cầu tối ưu của giống</h3>
                        <div class="space-y-5">
                            ${[
                                { label: 'Độ ẩm không khí (Humidity)', val: 75, color: 'bg-blue-500', icon: 'water_drop', desc: data.dieu_kien?.nuoc || 'Tưới nước đều mỗi ngày' },
                                { label: 'Độ pH & Dinh dưỡng đất (Soil)', val: 62, color: 'bg-emerald-500', icon: 'agriculture', desc: data.dieu_kien?.dat || 'Đất thịt nhẹ thoát nước nhanh' },
                                { label: 'Ánh sáng quang chu kỳ (Light)', val: 85, color: 'bg-amber-500', icon: 'light_mode', desc: 'Nhu cầu quang hợp toàn phần ngoài trời' }
                            ].map((item, idx) => `
                                <div class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 space-y-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-black text-on-surface flex items-center gap-1.5">
                                            <span class="material-symbols-outlined text-sm text-on-surface-variant">${item.icon}</span>
                                            ${item.label}
                                        </span>
                                        <span class="text-xs font-black text-primary">${item.val}%</span>
                                    </div>
                                    <div class="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                                        <div id="cm-pb-${idx}" class="${item.color} h-full rounded-full transition-all" style="width: 0%"></div>
                                    </div>
                                    <p class="text-[10px] text-on-surface-variant font-medium leading-normal">${item.desc}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    [75, 62, 85].forEach((val, idx) => {
                        const bar = document.getElementById(`cm-pb-${idx}`);
                        if (bar) Animator.animateProgressBar(bar, val);
                    });
                }, 100);
            } else if (this.activeTab === 'diseases') {
                if (data.sau_benh && data.sau_benh.length > 0) {
                    body.innerHTML = `
                        <div class="space-y-4 animate-fade-in">
                            <h3 class="font-black text-sm text-primary uppercase tracking-widest flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">bug_report</span> Sâu bệnh đặc thù thường gặp</h3>
                            <div class="grid grid-cols-1 gap-3">
                                ${data.sau_benh.map(sb => `
                                    <div class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 flex gap-4 hover:shadow-md transition-all">
                                        <span class="material-symbols-outlined text-red-500 text-3xl shrink-0 mt-1">coronavirus</span>
                                        <div>
                                            <h4 class="text-xs font-black text-on-surface">${sb.ten}</h4>
                                            <p class="text-[11px] text-on-surface-variant font-medium mt-1 leading-relaxed">${sb.mo_ta}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                } else {
                    body.innerHTML = `<div class="p-12 text-center text-xs text-on-surface-variant">Không ghi nhận dịch hại đặc thù.</div>`;
                }
            } else if (this.activeTab === 'growth') {
                body.innerHTML = `
                    <div class="space-y-6 animate-fade-in">
                        <h3 class="font-black text-sm text-primary uppercase tracking-widest flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">timeline</span> Nhật ký Vòng đời canh tác</h3>
                        <div class="relative pl-6 border-l-2 border-primary/20 space-y-8 ml-3 py-2">
                            ${[
                                { phase: 'Giai đoạn Gieo ủ (Sowing)', duration: 'Ngày 1 - 10', desc: 'Ủ hạt giống mọc mầm hoặc ươm cành giâm vào khay xơ dừa ẩm.' },
                                { phase: 'Chăm bón cây non (Seedling)', duration: 'Ngày 11 - 35', desc: 'Đưa mầm đất sang luống chính. Phòng trừ sâu bướm vẽ bùa phá hoại.' },
                                { phase: 'Sinh trưởng bứt phá (Vegetative)', duration: 'Tháng 2 - 3', desc: 'Thời kỳ cành lá vươn rộng. Bón thúc đạm NPK hữu cơ và kiểm soát tưới gốc.' },
                                { phase: 'Đơm hoa chín quả (Harvest)', duration: 'Cuối chu kỳ', desc: 'Ra cành hoa và chín vàng rộ. Giảm tưới 7 ngày trước thu hoạch.' }
                            ].map((p) => `
                                <div class="relative space-y-1">
                                    <div class="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-surface bg-primary"></div>
                                    <div class="flex justify-between items-baseline">
                                        <h4 class="text-xs font-black text-on-surface">${p.phase}</h4>
                                        <span class="text-[10px] font-black text-primary">${p.duration}</span>
                                    </div>
                                    <p class="text-[11px] text-on-surface-variant font-medium leading-relaxed">${p.desc}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else if (this.activeTab === 'ai') {
                body.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-12 gap-2 animate-fade-in">
                        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p class="text-[11px] text-on-surface-variant font-bold">AI đang phân tích rủi ro thời tiết thực tế...</p>
                    </div>
                `;
                
                try {
                    // Lấy thời tiết thực từ Open-Meteo và gửi phân tích AI
                    const position = await new Promise((resolve) => {
                        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 3000 });
                    });
                    
                    let lat = 10.0, lon = 106.0;
                    if (position) {
                        lat = position.coords.latitude;
                        lon = position.coords.longitude;
                    }
                    
                    const wData = await weatherService.getWeather(lat, lon);
                    const temp = wData.daily ? Math.round(wData.daily.temperature_2m_max[0]) : 28;
                    const humidity = wData.daily ? wData.daily.relative_humidity_2m_max[0] : 70;
                    
                    const aiResult = await cropService.getAIAnalysis(data.vi, temp, humidity, scCurrentRegion);
                    if (aiResult) {
                        body.innerHTML = `
                            <div class="space-y-5 animate-fade-in">
                                <div class="bg-primary/5 border border-primary/25 p-5 rounded-3xl flex gap-4">
                                    <span class="material-symbols-outlined text-primary text-3xl shrink-0">psychology</span>
                                    <div>
                                        <h4 class="text-sm font-black text-primary flex items-center gap-2">
                                            Phân tích tương thích nông học AI (Risk: ${aiResult.risk_score}%)
                                        </h4>
                                        <p class="text-xs text-on-surface-variant font-medium mt-2 leading-relaxed">
                                            Thời tiết khu vực của bạn đang ở mức **${temp}°C** và độ ẩm **${humidity}%**. 
                                            **Đánh giá khí hậu**: ${aiResult.weather_compatibility}
                                        </p>
                                    </div>
                                </div>

                                <div class="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/30 space-y-3">
                                    <h4 class="text-xs font-black text-on-surface flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-amber-500 text-sm">warning</span>
                                        Khuyến cáo rủi ro thiên tai & Sâu hại
                                    </h4>
                                    <ul class="text-[11px] text-on-surface-variant font-medium space-y-2 list-disc list-inside leading-relaxed">
                                        ${aiResult.warnings.map(w => `<li>${w}</li>`).join('')}
                                    </ul>
                                </div>

                                <div class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20">
                                    <h4 class="text-xs font-black text-primary flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-sm">insights</span>
                                        Lời khuyên từ AI & Kỹ sư
                                    </h4>
                                    <p class="text-xs text-on-surface-variant font-medium mt-2 leading-relaxed italic">
                                        "${aiResult.expert_tips}"
                                    </p>
                                    <p class="text-[10px] text-on-surface-variant font-bold mt-2 text-right">${aiResult.forecast}</p>
                                </div>
                            </div>
                        `;
                    }
                } catch (err) {
                    body.innerHTML = `
                        <div class="p-6 text-center text-xs text-on-surface-variant font-medium">
                            Không thể hoàn thành phân tích AI nông lịch. Vui lòng kết nối mạng ổn định.
                        </div>
                    `;
                }
            }
        }
    }

    // ==========================================
    // 4. COMPONENT: INTERACTIVE FARMING PLANNER
    // ==========================================
    class FarmingPlanner {
        constructor() {
            this.modal = document.getElementById('seasonal-calendar-modal');
            this.setupEscapeListener();
        }

        setupEscapeListener() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
                    this.close();
                }
            });
        }

        open() {
            const currentMonth = new Date().getMonth() + 1;
            const monthSelect = document.getElementById('sc-month-select');
            if (monthSelect) {
                monthSelect.value = currentMonth.toString();
            }
            window.updateSeasonalCalendarData();
            Animator.fadeIn(this.modal);
            document.body.style.overflow = 'hidden'; // Lock scroll
        }

        close() {
            Animator.fadeOut(this.modal);
            document.body.style.overflow = ''; // Unlock scroll
        }
    }

    // ==========================================
    // 5. COMPONENT: AGRICULTURE MAP SYSTEM (SVG-Based Layer Control)
    // ==========================================
    class AgricultureMap {
        constructor() {
            this.modalId = "agri-map-modal";
            this.activeLayer = "density"; // density | disease | weather
            this.regions = [];
        }

        async open() {
            this.regions = await mapService.getMapData();
            this.renderModal();
            const modalEl = document.getElementById(this.modalId);
            Animator.fadeIn(modalEl);
            document.body.style.overflow = 'hidden';
            this.renderMapCanvas();
        }

        close() {
            const modalEl = document.getElementById(this.modalId);
            if (modalEl) {
                Animator.fadeOut(modalEl);
            }
            document.body.style.overflow = '';
        }

        renderModal() {
            let modalEl = document.getElementById(this.modalId);
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = this.modalId;
                modalEl.className = "modal-overlay hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] items-center justify-center p-4";
                document.body.appendChild(modalEl);
            }

            modalEl.innerHTML = `
                <div class="bg-surface w-full max-w-4xl rounded-[32px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border border-outline-variant animate-fade-in" onclick="event.stopPropagation()">
                    <!-- Header -->
                    <div class="bg-primary text-white p-6 flex justify-between items-center shrink-0">
                        <div class="flex items-center gap-4">
                            <button onclick="window.AgriExplore.agricultureMap.close()" class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all">
                                <span class="material-symbols-outlined">close</span>
                            </button>
                            <div>
                                <h2 class="text-xl font-black text-white">Bản đồ Phân bố Nông nghiệp Quốc gia</h2>
                                <p class="text-xs opacity-80 text-white/90">Trực quan hóa vùng canh tác hữu cơ, dự báo dịch hại & thời tiết dông sét</p>
                            </div>
                        </div>
                    </div>

                    <!-- Layer Controls -->
                    <div class="bg-surface-container-low p-4 border-b border-outline-variant/30 flex flex-wrap gap-3 items-center justify-between shrink-0">
                        <div class="flex gap-2">
                            <button id="map-layer-density" onclick="window.AgriExplore.agricultureMap.switchLayer('density')" class="px-4 py-2 rounded-full text-xs font-black ${this.activeLayer === 'density' ? 'bg-primary text-white border border-primary' : 'bg-white text-on-surface border border-outline-variant'} transition-all flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">eco</span> Mật độ vùng trồng</button>
                            <button id="map-layer-disease" onclick="window.AgriExplore.agricultureMap.switchLayer('disease')" class="px-4 py-2 rounded-full text-xs font-black ${this.activeLayer === 'disease' ? 'bg-primary text-white border border-primary' : 'bg-white text-on-surface border border-outline-variant'} transition-all flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">coronavirus</span> Dịch bệnh hại</button>
                            <button id="map-layer-weather" onclick="window.AgriExplore.agricultureMap.switchLayer('weather')" class="px-4 py-2 rounded-full text-xs font-black ${this.activeLayer === 'weather' ? 'bg-primary text-white border border-primary' : 'bg-white text-on-surface border border-outline-variant'} transition-all flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">thunderstorm</span> Cảnh báo dông</button>
                        </div>
                        <span class="text-xs font-bold text-on-surface-variant" id="map-region-count">Có 4 vùng dữ liệu</span>
                    </div>

                    <!-- Map Body -->
                    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
                        <!-- Left Panel: SVG Map Canvas -->
                        <div class="flex-1 bg-surface-container-lowest p-6 relative flex items-center justify-center min-h-[300px]">
                            <svg id="map-svg-canvas" viewBox="0 0 500 500" class="w-full h-full max-h-[50vh] md:max-h-[60vh] drop-shadow-md">
                                <!-- Base Vietnam Shape mock -->
                                <path d="M220 50 L240 70 L230 110 L250 160 L240 220 L270 260 L260 300 L240 330 L250 380 L230 420 L200 450 L180 430 L160 400 L200 370 L190 320 L210 260 L210 180 L200 130 Z" 
                                      fill="#f0fdf4" stroke="#86efac" stroke-width="2" class="transition-all"></path>
                                <!-- Interactive markers -->
                                ${this.regions.map((r, i) => {
                                    // Chuyển đổi tọa độ lat/lon thành SVG coordinates
                                    const y = 500 - ((r.lat - 8) * 30);
                                    const x = (r.lon - 102) * 50;
                                    
                                    let markerColor = "#22c55e"; // green
                                    if (this.activeLayer === 'disease') {
                                        markerColor = r.disease_severity > 20 ? "#ef4444" : "#f59e0b"; // red or amber
                                    } else if (this.activeLayer === 'weather') {
                                        markerColor = r.disease_severity > 25 ? "#3b82f6" : "#6366f1"; // blue/indigo
                                    }

                                    return `
                                        <g class="cursor-pointer group" onclick="window.AgriExplore.agricultureMap.selectRegion(${i})">
                                            <circle cx="${x}" cy="${y}" r="12" fill="${markerColor}" fill-opacity="0.3" class="animate-ping"></circle>
                                            <circle cx="${x}" cy="${y}" r="7" fill="${markerColor}" stroke="#ffffff" stroke-width="1.5" class="group-hover:scale-125 transition-all"></circle>
                                            <text x="${x + 10}" y="${y + 4}" font-size="9" font-weight="900" fill="#374151" class="drop-shadow-sm pointer-events-none">${r.name}</text>
                                        </g>
                                    `;
                                }).join('')}
                            </svg>
                        </div>
                        
                        <!-- Right Panel: Info display -->
                        <div class="w-full md:w-80 bg-surface-container-low border-t md:border-t-0 md:border-l border-outline-variant/30 p-6 flex flex-col gap-4 overflow-y-auto" id="map-info-panel">
                            <div class="h-full flex flex-col justify-center items-center text-center text-on-surface-variant text-xs font-medium">
                                <span class="material-symbols-outlined text-4xl opacity-30 mb-2">touch_app</span>
                                Nhấn vào một vòng tròn marker trên bản đồ để xem phân tích số liệu khu vực.
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Xử lý Escape key cho map
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.close();
            });
        }

        switchLayer(layerName) {
            this.activeLayer = layerName;
            this.renderModal();
            this.renderMapCanvas();
        }

        selectRegion(idx) {
            const panel = document.getElementById('map-info-panel');
            const region = this.regions[idx];
            if (!panel || !region) return;

            let metricTitle = "Mật độ cây hữu cơ";
            let metricVal = `${region.crop_density}%`;
            let metricIcon = "eco";
            let metricColor = "text-primary";

            if (this.activeLayer === 'disease') {
                metricTitle = "Độ phủ bệnh hại";
                metricVal = `${region.disease_severity}%`;
                metricIcon = "coronavirus";
                metricColor = region.disease_severity > 20 ? "text-red-500" : "text-amber-500";
            } else if (this.activeLayer === 'weather') {
                metricTitle = "Độ ẩm khí quyển";
                metricVal = `${region.crop_density - 5}%`;
                metricIcon = "water_drop";
                metricColor = "text-blue-500";
            }

            panel.innerHTML = `
                <div class="space-y-5 animate-fade-in">
                    <div>
                        <span class="text-[10px] font-black text-primary uppercase tracking-widest">Khu vực phân tích</span>
                        <h3 class="text-lg font-black text-on-surface mt-1">${region.name}</h3>
                        <p class="text-xs text-on-surface-variant font-medium mt-0.5">Tọa độ: ${region.lat}° vĩ Bắc, ${region.lon}° kinh Đông</p>
                    </div>

                    <div class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center ${metricColor}">
                            <span class="material-symbols-outlined text-[24px]">${metricIcon}</span>
                        </div>
                        <div>
                            <span class="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block">${metricTitle}</span>
                            <b class="text-base font-black text-on-surface mt-0.5 block">${metricVal}</b>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <span class="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block">Tình trạng thực tế</span>
                        <div class="p-3 bg-primary/5 rounded-xl border border-primary/10 text-xs font-black text-primary flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm">insights</span>
                            ${region.status}
                        </div>
                    </div>

                    <div class="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 space-y-2 text-xs">
                        <h4 class="font-bold text-on-surface">Đánh giá chung vụ mùa:</h4>
                        <p class="text-on-surface-variant leading-relaxed font-medium">
                            Khu vực đang duy trì tốt nhịp độ tưới tiêu. ${this.activeLayer === 'disease' && region.disease_severity > 20 ? 'Khuyến nghị khẩn cấp: Cách ly vùng nhiễm bệnh và hạn chế sử dụng thuốc hóa học.' : 'Các giống lúa thơm ST25 và ngô nếp đang bước vào giai đoạn cho quả.'}
                        </p>
                    </div>
                </div>
            `;
        }

        renderMapCanvas() {
            // Tác động trực tiếp lên SVG nếu cần tinh chỉnh màu sắc bổ sung ở đây
        }
    }

    // Khởi tạo các module
    window.AgriExplore.searchDropdown = new SearchDropdown();
    window.AgriExplore.cropModal = new CropModal();
    window.AgriExplore.farmingPlanner = new FarmingPlanner();
    window.AgriExplore.agricultureMap = new AgricultureMap();

    // ==========================================
    // 6. GLOBAL BRIDGES (OVERRIDING OLD APP LOGIC)
    // ==========================================
    window.openCropDetails = (cropName) => window.AgriExplore.cropModal.open(cropName);
    window.closeCropDetails = () => window.AgriExplore.cropModal.close();
    window.openSeasonalCalendar = () => window.AgriExplore.farmingPlanner.open();
    window.closeSeasonalCalendar = () => window.AgriExplore.farmingPlanner.close();
    window.openAgricultureMap = () => window.AgriExplore.agricultureMap.open();

    // Carousel bridges
    window.prevHeroNews = () => {
        if (window.AgriExplore.heroSlider) window.AgriExplore.heroSlider.prev();
    };
    window.nextHeroNews = () => {
        if (window.AgriExplore.heroSlider) window.AgriExplore.heroSlider.next();
    };

    // Override Lịch mùa vụ vùng miền
    window.switchSeasonalRegion = function (region) {
        scCurrentRegion = region;
        const activeClass = "px-4 py-1.5 rounded-full text-xs font-black bg-primary text-white border border-primary transition-all";
        const inactiveClass = "px-4 py-1.5 rounded-full text-xs font-black bg-white text-on-surface border border-outline-variant transition-all";
        
        const btnNorth = document.getElementById('sc-btn-north');
        const btnCentral = document.getElementById('sc-btn-central');
        const btnSouth = document.getElementById('sc-btn-south');
        
        if (btnNorth) btnNorth.className = (region === 'Bắc') ? activeClass : inactiveClass;
        if (btnCentral) btnCentral.className = (region === 'Trung') ? activeClass : inactiveClass;
        if (btnSouth) btnSouth.className = (region === 'Nam') ? activeClass : inactiveClass;
        
        window.updateSeasonalCalendarData();
    };

    window.updateSeasonalCalendarData = async function () {
        const monthSelect = document.getElementById('sc-month-select');
        if (!monthSelect) return;
        const monthVal = parseInt(monthSelect.value);
        
        const data = await calendarService.getSeasonalCalendar(monthVal, scCurrentRegion);
        if (!data) return;
        
        const regionTitle = document.getElementById('sc-region-title');
        const weatherSummary = document.getElementById('sc-weather-summary');
        if (regionTitle) regionTitle.innerText = data.region_title;
        if (weatherSummary) weatherSummary.innerText = data.weather_summary;
        
        // Cập nhật biểu tượng thời tiết nông lịch
        const weatherIcon = document.getElementById('sc-weather-icon');
        if (weatherIcon) {
            if (data.weather_summary.includes('rét') || data.weather_summary.includes('lạnh')) {
                weatherIcon.innerText = 'ac_unit';
                weatherIcon.style.color = '#38bdf8';
            } else if (data.weather_summary.includes('mưa') || data.weather_summary.includes('ẩm')) {
                weatherIcon.innerText = 'rainy';
                weatherIcon.style.color = '#0284c7';
            } else {
                weatherIcon.innerText = 'light_mode';
                weatherIcon.style.color = '#f59e0b';
            }
        }
        
        const listPlant = document.getElementById('sc-list-plant');
        const listCare = document.getElementById('sc-list-care');
        const listHarvest = document.getElementById('sc-list-harvest');
        
        if (listPlant) listPlant.innerHTML = data.plants.map(item => `<li class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px] text-primary">circle</span>${item}</li>`).join('');
        if (listCare) listCare.innerHTML = data.care.map(item => `<li class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px] text-secondary">circle</span>${item}</li>`).join('');
        if (listHarvest) listHarvest.innerHTML = data.harvest.map(item => `<li class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px] text-amber-500">circle</span>${item}</li>`).join('');
        
        const warningText = document.getElementById('sc-warning-text');
        if (warningText) warningText.innerText = data.warning;
    };

    // Khởi tạo/tải trang Khám Phá chính thức
    window.loadExploreContent = async function () {
        console.log("PRODUCTION: loadExploreContent triggered");
        
        // 1. Khởi tạo slider và nạp tin tức từ API
        window.AgriExplore.heroSlider = new HeroNewsSlider();
        
        // 2. Nạp Lịch Thời Tiết
        window.updateWeatherAndSuggestions();
        
        // 3. Nạp Cây Trồng Xu Hướng động từ API
        window.renderTrendingCrops();
        
        // 4. Các bộ sưu tập phụ (render fallback tĩnh hoặc động)
        if (window.renderCollections) window.renderCollections();
        if (window.renderFocusArticle) window.renderFocusArticle();
        if (window.renderOtherNewsList) window.renderOtherNewsList();
    };

    // Override render cây trồng xu hướng động từ API
    window.renderTrendingCrops = async function () {
        const container = document.getElementById('trending-crops-container');
        if (!container) return;

        // Render skeleton shimmer
        container.innerHTML = Array(3).fill(0).map(() => `
            <div class="min-w-[220px] bg-neutral-100 rounded-[32px] border border-outline-variant h-44 animate-pulse p-4 flex flex-col justify-end gap-2">
                <div class="h-4 bg-neutral-200 w-2/3 rounded"></div>
                <div class="h-3 bg-neutral-200 w-1/2 rounded"></div>
            </div>
        `).join('');

        const crops = await cropService.getTrendingCrops();
        if (crops.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-xs text-on-surface-variant font-medium w-full">Không có cây trồng xu hướng hôm nay.</div>`;
            return;
        }

        container.innerHTML = crops.map(crop => `
            <div class="min-w-[220px] bg-white rounded-[32px] border border-outline-variant shadow-sm overflow-hidden snap-start group cursor-pointer hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all" 
                 onclick="window.openCropDetails('${crop.name}')">
                <div class="h-28 relative overflow-hidden">
                    <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                         src="${crop.img}" onerror="if(!this.dataset.failed){ this.dataset.failed=true; this.src='https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=400'; }"
                         alt="${crop.name}" loading="lazy">
                </div>
                <div class="p-4">
                    <span class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest block">${crop.category}</span>
                    <h3 class="text-xs font-black text-on-surface mt-1 truncate">${crop.name}</h3>
                    <div class="flex items-center gap-1 mt-2 text-[10px] text-primary font-black">
                        <span class="material-symbols-outlined text-[14px]">visibility</span>
                        <span>${Formatter.formatViews(crop.views)} lượt quan tâm</span>
                    </div>
                </div>
            </div>
        `).join('');
    };

    // Override cập nhật Thời Tiết Widget ở Bento Grid
    window.updateWeatherAndSuggestions = async function () {
        const monthEl = document.getElementById('calendar-month');
        const tempEl = document.getElementById('weather-temp');
        const descEl = document.getElementById('weather-desc');
        const iconEl = document.getElementById('weather-icon');
        const suggestionContainer = document.getElementById('action-suggestions-container');

        const now = new Date();
        const month = now.getMonth() + 1;
        if (monthEl) monthEl.innerText = `Tháng ${month}`;

        const handleSuccess = async (position) => {
            let lat = 10.0, lon = 106.0;
            if (position) {
                lat = position.coords.latitude;
                lon = position.coords.longitude;
            }
            
            const wData = await weatherService.getWeather(lat, lon);
            if (wData && wData.daily) {
                const temp = Math.round(wData.daily.temperature_2m_max[0]);
                const humidity = wData.daily.relative_humidity_2m_max[0];
                
                if (tempEl) tempEl.innerText = `${temp}°C`;
                
                // Trực quan hóa cảnh báo
                const alert = wData.alerts[0] || { icon: "☀️", title: "Thời tiết Thuận lợi", desc: "Khí hậu ổn định" };
                if (descEl) descEl.innerText = alert.title;
                if (iconEl) iconEl.innerText = alert.icon === "🍄" ? "spa" : (alert.icon === "🌊" ? "water_damage" : "light_mode");
                
                // Tạo các gợi ý nông lịch
                if (suggestionContainer) {
                    let suggestions = [];
                    if (temp > 30) {
                        suggestions.push({ icon: "water_drop", text: "Tăng lượng nước tưới gốc tránh bốc hơi." });
                    }
                    if (humidity > 80) {
                        suggestions.push({ icon: "pest_control", text: "Độ ẩm ẩm ướt dễ phát sinh nấm, rải vôi bột khử khuẩn." });
                    }
                    if (month === 5 || month === 6) {
                        suggestions.push({ icon: "agriculture", text: "Bắt đầu vụ Hè Thu, làm đất khơi thông rãnh thoát nước." });
                    }
                    if (suggestions.length === 0) {
                        suggestions.push({ icon: "monitoring", text: "Kiểm tra định kỳ sâu bệnh hại." });
                    }
                    
                    suggestionContainer.innerHTML = suggestions.map(s => `
                        <div class="flex items-center gap-3 p-3 bg-white rounded-2xl border border-outline-variant/30 hover:shadow-sm transition-all">
                            <div class="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary">
                                <span class="material-symbols-outlined text-[20px]">${s.icon}</span>
                            </div>
                            <p class="text-[12px] font-bold text-on-surface leading-snug">${s.text}</p>
                        </div>
                    `).join('');
                }
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(handleSuccess, () => handleSuccess(null), { timeout: 3000 });
        } else {
            handleSuccess(null);
        }
    };

})();
