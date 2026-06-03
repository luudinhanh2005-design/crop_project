// --- CONFIG ĐÃ CHUYỂN VÀO INDEX.HTML ---
console.log("app_premium_v3.js is loading...");

// --- HỖ TRỢ KẾT NỐI API TRÊN CAPACITOR ---
(function () {
    const isCapacitor = window.location.hostname === 'localhost' && window.location.port === '' || window.location.protocol.startsWith('capacitor');
    if (isCapacitor) {
        console.log("[Capacitor] API redirect helper activated.");
        const originalFetch = window.fetch;
        window.fetch = function (input, init) {
            if (typeof input === 'string' && (input.startsWith('/api/') || input.startsWith('/predict') || input.startsWith('/reclassify'))) {
                let backendIP = localStorage.getItem('backend_ip');
                // Tự động chuyển hướng nếu bộ nhớ đệm điện thoại vẫn lưu IP local cũ
                if (!backendIP || backendIP === '192.168.1.15:8000') {
                    backendIP = 'agrisocial-4yyx.onrender.com'; // Mặc định dùng Render cloud server
                    localStorage.setItem('backend_ip', backendIP);
                }

                let targetUrl = '';
                if (backendIP.startsWith('http://') || backendIP.startsWith('https://')) {
                    targetUrl = `${backendIP}${input}`;
                } else {
                    // Nếu là IP nội bộ, localhost hoặc chứa cổng 8000 thì dùng http, ngược lại (domain cloud) dùng https
                    const isLocal = /^[0-9.]+(:[0-9]+)?$/.test(backendIP) || backendIP.includes('localhost') || backendIP.includes('192.168.') || backendIP.includes(':8000');
                    const protocol = isLocal ? 'http://' : 'https://';
                    targetUrl = `${protocol}${backendIP}${input}`;
                }

                input = targetUrl;
                console.log("[Capacitor] Redirecting fetch to:", input);
            }
            return originalFetch(input, init);
        };

        // Bấm đúp màn hình để thay đổi IP máy chủ dễ dàng
        window.addEventListener('DOMContentLoaded', () => {
            document.body.addEventListener('dblclick', (e) => {
                // Tránh trùng lặp khi nhấp đúp vào nút bấm hoặc input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                const current = localStorage.getItem('backend_ip') || 'agrisocial-4yyx.onrender.com';
                const newIP = prompt("Nhập địa chỉ IP/Domain của máy chủ Backend (ví dụ: agrisocial-4yyx.onrender.com hoặc 192.168.1.15:8000):", current);
                if (newIP) {
                    localStorage.setItem('backend_ip', newIP.trim());
                    alert("Đã cập nhật IP máy chủ: " + newIP.trim() + "\nỨng dụng sẽ tự động tải lại.");
                    window.location.reload();
                }
            });
        });
    }
})();

var currentUser = window.currentUser || null;

// --- PLACEHOLDERS FOR MISSING FUNCTIONS ---
window.triggerRiskAlert = window.triggerRiskAlert || function (crop) { console.log("Triggering risk alert for:", crop); };
window.loadTreatments = window.loadTreatments || function (crop) { console.log("Loading treatments for:", crop); };
window.loadWeatherAlerts = window.loadWeatherAlerts || function () { console.log("Loading weather alerts..."); };
let scanHistory = [];
let currentResult = null;
let stream = null;
let cropChartInstance = null;
let postStream = null;
let searchTimeout = null;
window.activeCommentPostId = null;

// DOM Elements
let btnCamera, btnCapture, fileUpload, video, imgPreview, heatmapImg, canvas, scannerBox, radarAnim, overlay, placeholder, dynEncyc, placeholderEncyc;

// --- DATA MOCK ---
const TRENDING_CROPS = [
    { name: 'Lúa', post_count: '1,234', icon: '🌾', color: 'bg-orange-100' },
    { name: 'Ngô', post_count: '892', icon: '🌽', color: 'bg-yellow-100' },
    { name: 'Đậu tương', post_count: '673', icon: '🌱', color: 'bg-green-100' },
    { name: 'Khoai lang', post_count: '521', icon: '🍠', color: 'bg-red-100' },
    { name: 'Cà phê', post_count: '445', icon: '☕', color: 'bg-amber-100' }
];

// ================================================================ //
// ========= PREMIUM NOTIFICATION SYSTEM (Real-time + DB) ========= //
// ================================================================ //
let notificationsCache = [];
let currentNotifFilter = 'all';
let notifRealtimeChannel = null;

// Lấy thông báo thực từ API (kèm tọa độ để sinh cảnh báo dịch bệnh cục bộ)
window.fetchNotifications = async function (showSkeleton = true) {
    if (!currentUser || !currentUser.id) return;

    // Hiện skeleton loading
    if (showSkeleton) {
        const skeleton = document.getElementById('notif-skeleton');
        if (skeleton) skeleton.style.display = 'flex';
    }

    try {
        let data = [];
        const lat = window.userLat || parseFloat(localStorage.getItem('user_lat')) || null;
        const lng = window.userLng || parseFloat(localStorage.getItem('user_lng')) || null;
        let queryUrl = `/api/community/notifications?user_id=${currentUser.id}`;
        if (lat !== null && lng !== null) {
            queryUrl += `&lat=${lat}&lng=${lng}`;
        }

        // Gọi qua API backend trước để nhận đầy đủ cảnh báo dịch bệnh thông minh
        try {
            const res = await fetch(queryUrl);
            if (res.ok) data = await res.json();
        } catch (apiErr) {
            console.warn("API notifications fetch failed, falling back to Supabase client:", apiErr);
        }

        // Fallback trực tiếp qua Supabase Client nếu API lỗi
        if (data.length === 0 && window.supabaseClient) {
            try {
                const { data: result, error } = await window.supabaseClient
                    .from('notifications')
                    .select('*, actor_profiles:profiles!actor_id(full_name, avatar_url)')
                    .eq('user_id', currentUser.id)
                    .order('created_at', { ascending: false })
                    .limit(30);
                if (!error && result) data = result;
            } catch (e) { }
        }

        notificationsCache = data;

        // Trộn cảnh báo thời tiết thực tế ở frontend nếu có
        if (window.currentWeatherAlert) {
            // Tránh chèn trùng lặp
            const exists = notificationsCache.some(n => n.id === window.currentWeatherAlert.id);
            if (!exists) {
                // Đảm bảo không trùng với các cảnh báo thời tiết cũ
                notificationsCache = notificationsCache.filter(n => n.id !== window.currentWeatherAlert.id);
                notificationsCache.unshift(window.currentWeatherAlert);
            }
        }

        renderNotificationsPage();
        updateNotifBadgeCount();
    } catch (err) {
        console.error("Lỗi lấy thông báo:", err);
    } finally {
        const skeleton = document.getElementById('notif-skeleton');
        if (skeleton) skeleton.style.display = 'none';
    }
};

// Tạo thông báo mới (gọi khi Like/Comment/Follow)
window.createNotification = async function (targetUserId, type, postId = null, commentText = null, previewUrl = null) {
    if (!currentUser || !currentUser.id) return;

    try {
        if (window.supabaseClient) {
            const payload = {
                user_id: targetUserId,
                actor_id: currentUser.id,
                type: type,
                post_id: postId,
                comment_text: commentText,
                preview_url: previewUrl,
                is_read: false
            };
            await window.supabaseClient.from('notifications').insert([payload]);
        }
    } catch (err) {
        console.error("Lỗi tạo thông báo:", err);
    }
};

// Render thông báo lên trang + popover
window.renderNotificationsPage = function () {
    const fullList = document.getElementById('full-notifications-list');
    const popoverList = document.getElementById('notifications-list');

    const filtered = currentNotifFilter === 'all'
        ? notificationsCache
        : notificationsCache.filter(n => n.type === currentNotifFilter);

    // Render Stats Overview Grid
    const statsContainer = document.getElementById('notifications-stats-container');
    if (statsContainer) {
        const unreadCount = notificationsCache.filter(n => !n.is_read).length;
        const alertCount = notificationsCache.filter(n => n.type === 'alert').length;
        const interactionCount = notificationsCache.filter(n => ['like', 'comment', 'follow'].includes(n.type)).length;

        statsContainer.innerHTML = `
            <div class="grid grid-cols-3 gap-3 mb-6 animate-fade-in">
                <!-- Card 1: Unread Notifications -->
                <div class="bg-gradient-to-br from-emerald-500/[0.04] to-green-600/[0.04] border border-green-500/10 rounded-2xl p-3 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
                        <span class="material-symbols-outlined text-[18px]">notifications</span>
                    </div>
                    <div class="min-w-0">
                        <div class="text-[14px] font-black text-green-800 leading-none">${unreadCount}</div>
                        <div class="text-[9px] font-bold text-green-700/60 uppercase tracking-wider mt-0.5 truncate">Chưa đọc</div>
                    </div>
                </div>
                <!-- Card 2: Alerts -->
                <div class="bg-gradient-to-br from-orange-500/[0.04] to-amber-600/[0.04] border border-orange-500/10 rounded-2xl p-3 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shadow-sm shrink-0">
                        <span class="material-symbols-outlined text-[18px]">warning</span>
                    </div>
                    <div class="min-w-0">
                        <div class="text-[14px] font-black text-orange-800 leading-none">${alertCount}</div>
                        <div class="text-[9px] font-bold text-orange-700/60 uppercase tracking-wider mt-0.5 truncate">Cảnh báo</div>
                    </div>
                </div>
                <!-- Card 3: Interactions -->
                <div class="bg-gradient-to-br from-blue-500/[0.04] to-indigo-600/[0.04] border border-blue-500/10 rounded-2xl p-3 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                        <span class="material-symbols-outlined text-[18px]">volunteer_activism</span>
                    </div>
                    <div class="min-w-0">
                        <div class="text-[14px] font-black text-blue-800 leading-none">${interactionCount}</div>
                        <div class="text-[9px] font-bold text-blue-700/60 uppercase tracking-wider mt-0.5 truncate">Tương tác</div>
                    </div>
                </div>
            </div>`;
    }

    if (filtered.length === 0) {
        const emptyHtml = `
            <div class="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                <div class="w-20 h-20 rounded-full bg-slate-50 border border-slate-200/50 flex items-center justify-center mb-4">
                    <span class="material-symbols-outlined text-4xl text-slate-400">notifications_off</span>
                </div>
                <h3 class="font-bold text-slate-800 text-lg mb-1">Chưa có thông báo</h3>
                <p class="text-slate-500 text-sm max-w-[280px]">Khi có cập nhật hoặc cảnh báo mới, chúng sẽ xuất hiện ở đây.</p>
            </div>`;
        if (fullList) fullList.innerHTML = emptyHtml;
        if (popoverList) popoverList.innerHTML = emptyHtml;
        return;
    }

    // Render Popover (Flat, tối đa 5 thông báo)
    if (popoverList) {
        popoverList.innerHTML = filtered.slice(0, 5).map(n => renderSingleNotification(n, true)).join('');
    }

    // Render danh sách chính (Có phân nhóm thời gian)
    if (fullList) {
        const todayItems = [];
        const yesterdayItems = [];
        const olderItems = [];

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

        filtered.forEach(n => {
            const timeVal = n.created_at ? new Date(n.created_at).getTime() : Date.now();
            if (timeVal >= todayStart.getTime()) {
                todayItems.push(n);
            } else if (timeVal >= yesterdayStart.getTime()) {
                yesterdayItems.push(n);
            } else {
                olderItems.push(n);
            }
        });

        let groupedHtml = "";

        const renderGroup = (title, items) => {
            if (items.length === 0) return "";
            return `
                <div class="mb-6 animate-fade-in">
                    <h3 class="text-[11px] font-black uppercase tracking-wider text-slate-400 px-2 mb-3 flex items-center gap-2">
                        <span>${title}</span>
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                        <span class="text-[10px] font-normal lowercase tracking-normal">(${items.length} thông báo)</span>
                    </h3>
                    <div class="flex flex-col gap-3">
                        ${items.map(n => renderSingleNotification(n, false)).join('')}
                    </div>
                </div>`;
        };

        groupedHtml += renderGroup("Hôm nay", todayItems);
        groupedHtml += renderGroup("Hôm qua", yesterdayItems);
        groupedHtml += renderGroup("Trước đó", olderItems);

        fullList.innerHTML = groupedHtml;
    }
};

// Render 1 thông báo
function renderSingleNotification(n, compact = false) {
    const actor = n.actor_profiles || {};
    const userName = actor.full_name || n.user_name || (n.actor_id === 'system_alert' || n.actor_id === 'system_weather' ? 'Hệ thống' : 'AgriSocial');
    const avatarUrl = actor.avatar_url || n.avatar_url;
    const isUnread = !n.is_read;

    // Tính thời gian
    let timeStr = "Vừa xong";
    if (n.created_at) {
        const diff = Date.now() - new Date(n.created_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) timeStr = "Vừa xong";
        else if (mins < 60) timeStr = `${mins} phút trước`;
        else if (mins < 1440) timeStr = `${Math.floor(mins / 60)} giờ trước`;
        else if (mins < 10080) timeStr = `${Math.floor(mins / 1440)} ngày trước`;
        else timeStr = new Date(n.created_at).toLocaleDateString('vi-VN');
    }

    // Icon + màu gradient theo loại
    const typeConfig = {
        like: { icon: 'favorite', gradient: 'from-pink-500 to-rose-600', fill: 1, text: 'đã thích bài viết của bạn', border: 'hover:border-rose-200/50' },
        comment: { icon: 'chat_bubble', gradient: 'from-blue-500 to-indigo-600', fill: 1, text: 'đã bình luận trên bài viết', border: 'hover:border-indigo-200/50' },
        follow: { icon: 'person_add', gradient: 'from-emerald-400 to-green-600', fill: 1, text: 'đã bắt đầu theo dõi bạn', border: 'hover:border-emerald-200/50' },
        alert: { icon: 'warning', gradient: 'from-amber-400 to-orange-600', fill: 1, text: n.comment_text || 'Cảnh báo dịch hại/thời tiết', border: 'border-orange-200 bg-orange-50/[0.08] hover:border-orange-300' },
        expert_answer: { icon: 'eco', gradient: 'from-teal-400 to-emerald-600', fill: 0, text: 'đã trả lời câu hỏi của bạn', border: 'hover:border-teal-200/50' },
        group_activity: { icon: 'groups', gradient: 'from-slate-400 to-slate-600', fill: 0, text: n.comment_text || 'Hoạt động mới trong nhóm', border: 'hover:border-slate-300' },
    };
    const cfg = typeConfig[n.type] || { icon: 'notifications', gradient: 'from-neutral-400 to-neutral-600', fill: 0, text: '', border: 'hover:border-neutral-200/50' };

    const avatarHtml = avatarUrl
        ? `<img src="${avatarUrl}" class="w-12 h-12 rounded-2xl object-cover shrink-0 border border-neutral-100 shadow-sm ring-2 ring-white" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0d631b&color=fff'">`
        : `<div class="w-12 h-12 rounded-2xl bg-gradient-to-br ${cfg.gradient} text-white flex items-center justify-center shrink-0 border border-white/10 shadow-sm ring-2 ring-white">
               <span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' ${cfg.fill};">${cfg.icon}</span>
           </div>`;

    const actionHtml = n.type === 'follow' ? `
        <div id="follow-actions-${n.id}" class="mt-3">
            <div class="flex gap-2">
                <button onclick="event.stopPropagation(); window.handleFollowAction('${n.id}', 'accept', '${n.actor_id}')" class="flex-1 bg-gradient-to-r from-primary to-emerald-600 text-white text-[11px] font-bold py-2 rounded-xl shadow-[0_4px_12px_rgba(13,99,27,0.15)] hover:shadow-[0_6px_20px_rgba(13,99,27,0.3)] transition-all hover:scale-[1.02] active:scale-95 hover:brightness-110">Chấp nhận</button>
                <button onclick="event.stopPropagation(); window.handleFollowAction('${n.id}', 'ignore', '${n.actor_id}')" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-95">Bỏ qua</button>
            </div>
        </div>` : '';

    const commentQuoteHtml = (n.type === 'comment' && n.comment_text) ? `
        <div class="mt-2.5 px-4 py-3 bg-slate-50/60 border-l-4 border-indigo-500 rounded-r-2xl text-xs text-slate-700 shadow-inner relative leading-relaxed">
            <span class="absolute -top-2.5 left-2.5 text-indigo-300/40 text-3xl font-serif select-none">“</span>
            <p class="italic pl-1">"${n.comment_text}"</p>
        </div>` : '';

    const padding = compact ? 'px-3 py-3' : 'px-5 py-4.5';

    // Premium card border and backgrounds
    let cardBgClass = 'bg-white/80 backdrop-blur-md hover:border-primary/20 hover:shadow-[0_20px_50px_rgba(13,99,27,0.04)]';
    let alertBannerHtml = '';

    if (n.type === 'alert') {
        cardBgClass = 'bg-gradient-to-br from-amber-500/[0.02] to-red-500/[0.02] border-orange-200/80 hover:border-orange-400/80 hover:shadow-[0_20px_50px_rgba(245,158,11,0.06)]';
        alertBannerHtml = `
            <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-700 text-[9px] font-black uppercase tracking-wider mb-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse"></span>
                Khẩn cấp
            </div>`;
    }

    return `
        <div class="${padding} ${cardBgClass} rounded-[24px] border border-outline-variant/30 hover:-translate-y-1 transition-all duration-500 ease-out cursor-pointer relative overflow-hidden group ${isUnread ? 'ring-1 ring-primary/5 bg-gradient-to-r from-primary/[0.015] to-transparent' : ''}" style="animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;" onclick="event.stopPropagation(); if('${n.actor_id}' !== 'system_alert' && '${n.actor_id}' !== 'system_weather') { window.targetProfileId='${n.actor_id}'; switchTab('page-profile'); }">
            ${isUnread ? `<div class="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-primary to-emerald-600 rounded-r-full shadow-[0_0_10px_rgba(13,99,27,0.3)]"></div>` : ''}
            <div class="flex gap-3.5">
                <div class="relative shrink-0 select-none">
                    ${avatarHtml}
                    ${avatarUrl ? `
                    <div class="absolute -bottom-1 -right-1 w-5.5 h-5.5 rounded-full bg-gradient-to-br ${cfg.gradient} text-white flex items-center justify-center text-[10px] border-2 border-white shadow-sm ring-1 ring-black/[0.05]">
                        <span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' ${cfg.fill};">${cfg.icon}</span>
                    </div>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-0.5">
                        <div class="min-w-0">
                            ${alertBannerHtml}
                            <p class="text-[13px] text-slate-800 leading-snug">
                                <span class="font-bold text-slate-900">${userName}</span> ${n.type === 'alert' ? '' : cfg.text}
                            </p>
                        </div>
                        ${isUnread ? `
                        <div class="relative flex h-2 w-2 shrink-0 ml-2 mt-1 shadow-sm">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </div>` : ''}
                    </div>
                    <p class="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 select-none">
                        <span class="material-symbols-outlined text-[12px] text-slate-400/80">schedule</span>
                        <span>${timeStr}</span>
                    </p>
                    ${n.type === 'alert' ? `<p class="text-[12px] text-slate-700 mt-2.5 leading-relaxed font-medium bg-white/60 p-3 rounded-2xl border border-orange-100/50 shadow-inner">${n.comment_text}</p>` : ''}
                    ${commentQuoteHtml}
                    ${actionHtml}
                </div>
                ${n.preview_url ? `<div class="w-12 h-12 rounded-xl overflow-hidden border border-outline-variant/20 shrink-0 shadow-sm group-hover:scale-105 transition-transform select-none"><img src="${n.preview_url}" class="w-full h-full object-cover"></div>` : ''}
            </div>
        </div>`;
}

// Hàm lọc thông báo (Định nghĩa bổ sung)
window.filterNotifications = function (type) {
    currentNotifFilter = type;

    // Cập nhật class active cho các nút bộ lọc
    document.querySelectorAll('.notif-filter-btn').forEach(btn => {
        if (btn.getAttribute('data-filter') === type) {
            btn.className = 'notif-filter-btn active px-4 py-2.5 rounded-2xl text-[12px] font-black whitespace-nowrap bg-gradient-to-r from-primary to-emerald-600 text-white shadow-[0_4px_12px_rgba(13,99,27,0.2)] transition-all scale-[1.02] active:scale-95';
        } else {
            btn.className = 'notif-filter-btn px-4 py-2.5 rounded-2xl text-[12px] font-black whitespace-nowrap bg-slate-50 border border-slate-200/50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all hover:scale-[1.02] active:scale-95';
        }
    });

    renderNotificationsPage();
};

// Hàm đánh dấu tất cả đã đọc (Định nghĩa bổ sung)
window.markAllNotificationsRead = async function () {
    if (!currentUser || !currentUser.id) return;

    // 1. Phản hồi tức thì trên giao diện (Optimistic UI)
    notificationsCache.forEach(n => n.is_read = true);
    renderNotificationsPage();
    updateNotifBadgeCount();

    const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    try {
        if (window.supabaseClient && isUuid(currentUser.id) && currentUser.id !== "00000000-0000-0000-0000-000000000000") {
            const { error } = await window.supabaseClient
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUser.id)
                .eq('is_read', false);

            if (error) {
                console.error("Lỗi đánh dấu đọc Supabase:", error);
            }
        }
        showToast("Đã đánh dấu đọc tất cả thông báo! ✓", "success");
    } catch (err) {
        console.error("Lỗi thực thi đánh dấu đã đọc:", err);
    }
};

// Hàm xử lý hành động đồng ý/bỏ qua kết nối follow (Định nghĩa bổ sung)
window.handleFollowAction = async function (notifId, action, actorId) {
    const container = document.getElementById(`follow-actions-${notifId}`);
    if (container) {
        const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        if (action === 'accept') {
            container.innerHTML = `
                <div class="flex items-center gap-1 mt-2 text-primary font-bold text-xs bg-primary/5 py-1.5 px-3 rounded-lg border border-primary/20 w-fit animate-fade-in">
                    <span class="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Bạn và người này đang theo dõi nhau</span>
                </div>`;
            showToast("Đã chấp nhận yêu cầu theo dõi! 👤", "success");

            // Tiến hành cập nhật quan hệ follows trên cơ sở dữ liệu Supabase (chỉ chạy với ID thật)
            if (window.supabaseClient && currentUser && isUuid(currentUser.id) && isUuid(actorId) && currentUser.id !== "00000000-0000-0000-0000-000000000000") {
                try {
                    await window.supabaseClient.from('follows').insert([{
                        follower_id: currentUser.id,
                        following_id: actorId
                    }]);
                } catch (e) {
                    console.error("Lỗi cập nhật quan hệ follows:", e);
                }
            }
        } else {
            container.innerHTML = `
                <div class="flex items-center gap-1 mt-2 text-on-surface-variant/60 font-bold text-xs bg-surface-container-low py-1.5 px-3 rounded-lg w-fit animate-fade-in">
                    <span class="material-symbols-outlined text-[16px]">block</span>
                    <span>Đã bỏ qua yêu cầu theo dõi</span>
                </div>`;
            showToast("Đã bỏ qua yêu cầu theo dõi.", "info");
        }

        // Đánh dấu thông báo cụ thể này đã đọc trên Supabase (chỉ chạy với ID thật)
        if (window.supabaseClient && isUuid(notifId)) {
            try {
                await window.supabaseClient.from('notifications').update({ is_read: true }).eq('id', notifId);
            } catch (e) { }
        }
        const notif = notificationsCache.find(x => x.id === notifId);
        if (notif) {
            notif.is_read = true;
            updateNotifBadgeCount();
        }
    }
};


// Badge count trên icon chuông
window.updateNotifBadgeCount = function () {
    const badge = document.getElementById('notif-badge');
    const unreadCount = notificationsCache.filter(n => !n.is_read).length;
    if (badge) {
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        badge.innerText = unreadCount;
    }
};

window.toggleNotificationsPopover = function (e) {
    if (e) e.stopPropagation();
    const popover = document.getElementById('notifications-popover');
    if (!popover) return;

    const isVisible = !popover.classList.contains('invisible');
    const profileDropdown = document.querySelector('#header-avatar-container div');
    if (profileDropdown) {
        profileDropdown.style.opacity = '0';
        profileDropdown.style.visibility = 'hidden';
    }

    if (isVisible) {
        popover.classList.add('opacity-0', 'invisible', 'translate-y-2');
    } else {
        fetchNotifications(false);
        popover.classList.remove('opacity-0', 'invisible', 'translate-y-2');
    }
};

// Real-time listener cho thông báo mới
window.setupNotifRealtime = function () {
    if (!window.supabaseClient || !currentUser || !currentUser.id) return;
    // Huỷ channel cũ nếu có
    if (notifRealtimeChannel) {
        try { window.supabaseClient.removeChannel(notifRealtimeChannel); } catch (e) { }
    }
    try {
        notifRealtimeChannel = window.supabaseClient
            .channel('notif-realtime-' + currentUser.id)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${currentUser.id}`
            }, async (payload) => {
                console.log("🔔 Thông báo mới:", payload.new);
                // Fetch actor info
                let actorName = "Ai đó";
                if (payload.new.actor_id && window.supabaseClient) {
                    try {
                        const { data } = await window.supabaseClient
                            .from('profiles')
                            .select('full_name, avatar_url')
                            .eq('id', payload.new.actor_id)
                            .single();
                        if (data) {
                            payload.new.actor_profiles = data;
                            actorName = data.full_name || actorName;
                        }
                    } catch (e) { }
                }
                // Thêm vào đầu cache
                notificationsCache.unshift(payload.new);
                renderNotificationsPage();
                updateNotifBadgeCount();
                // Toast popup
                const typeEmoji = { like: '❤️', comment: '💬', follow: '👤', alert: '⚠️', expert_answer: '🌿' };
                const typeText = { like: 'đã thích bài viết', comment: 'đã bình luận', follow: 'đã theo dõi bạn', alert: 'Cảnh báo mới', expert_answer: 'đã trả lời câu hỏi' };
                const emoji = typeEmoji[payload.new.type] || '🔔';
                const text = typeText[payload.new.type] || 'Thông báo mới';
                showToast(`${emoji} ${actorName} ${text}`, "info");
            })
            .subscribe((status) => {
                console.log("Realtime notifications status:", status);
            });
    } catch (err) {
        console.error("Lỗi thiết lập Realtime:", err);
    }
};

// Render ban đầu (giữ tương thích với code gọi renderNotifications())
window.renderNotifications = function () {
    if (notificationsCache.length === 0 && currentUser) {
        fetchNotifications(false);
    } else {
        renderNotificationsPage();
        updateNotifBadgeCount();
    }
};

let mockUser = {
    full_name: "Thành viên mới",
    username: "user",
    bio: "Chào mừng bạn đến với AgriSocial!",
    location: "Việt Nam",
    join_date: "2026",
    website: "agrisocial.vn",
    avatar_url: "https://i.pravatar.cc/300?u=newuser",
    cover_url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
    stats: { posts: 0, followers: 0, following: 0 }
};

// ================================================================ //
// =================== GLOBAL UTILITIES =========================== //
// ================================================================ //

window.showToast = function (message, type = "info") {
    const container = document.getElementById("notification-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let icon = "🔔", title = "Thông báo";
    if (type === "success") { icon = "✅"; title = "Thành công"; }
    if (type === "error") { icon = "❌"; title = "Lỗi hệ thống"; }
    if (type === "info") { icon = "💡"; title = "Thông tin"; }

    toast.innerHTML = `
        <div class="toast-icon-circle">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add("active"), 10);
    setTimeout(() => {
        toast.classList.remove("active");
        setTimeout(() => toast.remove(), 500);
    }, 4500);
};

const originalAlert = window.alert;
window.alert = function (message) {
    let type = "info";
    if (message.toLowerCase().includes("lỗi") || message.toLowerCase().includes("error") || message.toLowerCase().includes("không")) {
        type = "error";
    } else if (message.toLowerCase().includes("thành công") || message.toLowerCase().includes("đã lưu")) {
        type = "success";
    }
    showToast(message, type);
};

function copyToClipboard(text) {
    const dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = text;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
    showToast("Đã sao chép liên kết vào bộ nhớ tạm! 📋", "success");
}

window.togglePassword = function (id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    const btn = input.nextElementSibling;
    if (btn && btn.classList.contains('toggle-pass')) {
        btn.innerText = input.type === 'password' ? '👁️' : '🙈';
    }
};

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new AudioContext(); }
function playTone(freq, type, duration) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.type = type;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

// ================================================================ //
// =================== INIT & CORE SETUP ========================== //
// ================================================================ //

window.init = async function () {
    console.log("App initializing...");

    btnCamera = document.getElementById('btn-camera');
    btnCapture = document.getElementById('btn-capture');
    fileUpload = document.getElementById('file-upload');
    video = document.getElementById('camera-stream');
    imgPreview = document.getElementById('preview-img');
    heatmapImg = document.getElementById('heatmap-img');
    canvas = document.getElementById('hidden-canvas');
    scannerBox = document.getElementById('scanner-box');
    radarAnim = document.getElementById('placeholder-text');
    overlay = document.getElementById('scan-overlay');
    placeholder = document.getElementById('placeholder-text');
    dynEncyc = document.getElementById('dynamic-encyc');
    placeholderEncyc = document.getElementById('crop-card');

    const savedToken = localStorage.getItem('agrisocial_token');
    const savedUser = localStorage.getItem('agrisocial_user');
    if (savedToken && savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            // Ưu tiên id hiện có, nếu không có mới dùng sub
            if (!currentUser.id && currentUser.sub) {
                currentUser.id = currentUser.sub;
            }

            // Kiểm tra xem có phải ID cũ (không phải UUID) không
            const isOldId = currentUser.id && typeof currentUser.id === 'string' && !currentUser.id.includes('-');
            if (isOldId) {
                console.log("Old session ID detected. Clearing...");
                localStorage.removeItem('agrisocial_token');
                localStorage.removeItem('agrisocial_user');
                location.reload();
                return;
            }

            // Đã đăng nhập -> Thêm class xác thực để ẩn Landing Page
            document.documentElement.classList.add('is-authenticated');
            document.body.classList.add('is-authenticated');

            // Cập nhật UI ngay lập tức từ cache
            updateAuthUI(currentUser);

            // QUAN TRỌNG: Gọi checkUser để đồng bộ lại với server và đảm bảo profile tồn tại
            checkUser();

            fetchSuggestedFriends();
            fetchTrendingCrops();
            fetchHistory();
            fetchCommunityFeed();
            renderNotifications();
            setupNotifRealtime();
        } catch (e) {
            console.error("Error parsing saved user:", e);
        }
    }

    try {
        setupEventListeners();
        // setupAdvancedFeatures(); // Hàm này đã được tích hợp hoặc không còn sử dụng
        setupBottomNav();
        initAuth();
        setupProfileTabs();
        setupGlobalInputProtection();
        setupHeaderSearch();
    } catch (err) {
        console.warn("Lỗi nhẹ khi khởi tạo các thành phần UI:", err);
    }

    const splash = document.getElementById('splash-screen');
    const btnContinue = document.getElementById('btn-continue');
    if (btnContinue && splash) {
        btnContinue.onclick = () => {
            initAudio();
            playTone(800, 'sine', 0.2);
            splash.style.opacity = '0';
            splash.style.transition = 'opacity 0.5s';
            setTimeout(() => { splash.style.display = 'none'; }, 500);
        };
    }

    // Ưu tiên nạp Dashboard trước
    loadExploreContent();

    fetchCommunityFeed();
    // loadBroadcast(); // Tạm khóa vì thiếu hàm định nghĩa
    // setInterval(loadBroadcast, 30000);
    // renderTrendingCrops();
    // renderMyGarden();

    // KHÔI PHỤC TRANG ĐÃ LƯU KHI RELOAD (F5)
    const savedPage = localStorage.getItem('agrisocial_current_page');
    console.log("DEBUG: init() - savedPage from localStorage:", savedPage);
    if (savedPage) {
        console.log("Đang khôi phục trang đã lưu:", savedPage);
        const savedTargetProfile = localStorage.getItem('agrisocial_target_profile_id');
        if (savedPage === 'page-profile' && savedTargetProfile) {
            window.targetProfileId = savedTargetProfile;
            window.bypassProfileReset = true;
        }
        // Gọi switchTab sau một khoảng trễ ngắn để đảm bảo các thành phần khác đã sẵn sàng
        setTimeout(() => {
            if (typeof switchTab === 'function') {
                switchTab(savedPage);
            }
        }, 300);
    } else {
        // Mặc định vào trang cộng đồng nếu không có trang lưu
        if (typeof switchTab === 'function') {
            switchTab('page-community');
        }
    }
}

// ================================================================ //
// =================== AUTHENTICATION LOGIC ======================= //
// ================================================================ //

window.handleDemoLoginJS = function () {
    let userData = null;
    try {
        const savedUser = localStorage.getItem('agrisocial_user');
        if (savedUser) userData = JSON.parse(savedUser);
    } catch (e) { }

    if (userData && userData.id) {
        currentUser = {
            id: userData.id, email: userData.email || "demo@agrisocial.vn",
            user_metadata: userData.user_metadata || { full_name: userData.full_name },
            profile: userData.profile || { full_name: userData.full_name || "Thành viên", role: "user" }
        };
    } else {
        currentUser = {
            id: "00000000-0000-0000-0000-000000000000", email: "demo@agrisocial.vn",
            user_metadata: { full_name: "Khách dùng thử", avatar_url: "https://i.pravatar.cc/150?u=demo" },
            profile: { full_name: "Khách dùng thử", bio: "Tôi đang trải nghiệm tính năng của AgriSocial", farm_location: "Việt Nam", role: "user", stats: { posts: 12, followers: 45, following: 20 } }
        };
    }

    const landing = document.getElementById('landing-page');
    if (landing) {
        landing.style.setProperty('display', 'none', 'important');
        landing.style.pointerEvents = 'none';
    }

    document.documentElement.classList.add('is-authenticated');
    document.body.classList.add('is-authenticated');
    if (document.getElementById('auth-modal')) document.getElementById('auth-modal').style.display = 'none';
    updateAuthUI(currentUser);
    fetchHistory();
    fetchCommunityFeed();
    fetchSuggestedFriends();
    fetchTrendingCrops();

    if (currentUser && currentUser.id !== "00000000-0000-0000-0000-000000000000") {
        heartBeat();
        setInterval(heartBeat, 60000);
    }
};
window.handleDemoLogin = window.handleDemoLoginJS;

async function heartBeat() {
    if (!currentUser || !currentUser.id || currentUser.id === "00000000-0000-0000-0000-000000000000") return;
    try {
        if (window.supabaseClient) {
            await window.supabaseClient.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
        }
    } catch (err) { }
}

async function checkUser() {
    try {
        if (!window.supabaseClient) return;
        const { data: { session } } = await window.supabaseClient.auth.getSession();

        if (session) {
            const user = session.user;
            const savedUserStr = localStorage.getItem('agrisocial_user');

            if (savedUserStr) {
                try {
                    const savedUser = JSON.parse(savedUserStr);
                    if (savedUser.id !== user.id) resetUIState();
                } catch (e) { }
            }

            let profile = null;
            try {
                // 1. Luôn lấy profile mới nhất từ Table 'profiles' trên Supabase
                const { data: existingProfile } = await window.supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                profile = existingProfile;

                // 2. Nếu chưa có profile trong database mới thực hiện tạo mới (upsert)
                if (!profile) {
                    const { data: newProfile } = await window.supabaseClient.from('profiles').upsert({
                        id: user.id,
                        full_name: user.user_metadata.full_name || user.user_metadata.name || user.email.split('@')[0],
                        avatar_url: user.user_metadata.avatar_url || user.user_metadata.picture,
                        username: user.email.split('@')[0] + "_" + Math.floor(Math.random() * 1000),
                        email: user.email,
                        role: 'user',
                        updated_at: new Date().toISOString()
                    }).select().single();
                    profile = newProfile;
                }
            } catch (err) {
                console.error("Lỗi truy vấn profile Supabase:", err);
            }

            // 3. TỔNG HỢP DỮ LIỆU: Ưu tiên Profile (Supabase) > Metadata (Google/FB)
            currentUser = {
                id: user.id,
                email: user.email,
                // Ưu tiên tên và ảnh từ profile trong Table (đã được bạn sửa thành ảnh lúa)
                full_name: profile?.full_name || user.user_metadata.full_name || "Thành viên",
                avatar_url: profile?.avatar_url || user.user_metadata.avatar_url || user.user_metadata.picture,
                username: profile?.username || user.email.split('@')[0],
                role: profile?.role || 'user',
                user_metadata: user.user_metadata,
                profile: profile
            };

            // 4. Lưu lại vào LocalStorage để các hàm khác dùng
            localStorage.setItem('agrisocial_user', JSON.stringify(currentUser));
            localStorage.setItem('agrisocial_token', session.access_token);

            // 5. Cập nhật giao diện ngay lập tức
            updateAuthUI(currentUser);

            // 6. Tự động chuyển hướng dựa trên vai trò
            handleRoleBasedRedirect(currentUser);

            // Hàm này cực kỳ quan trọng để thay thế các chữ cái L, N thành ảnh lúa mạch
            if (typeof updateAllUserUIElements === 'function') {
                updateAllUserUIElements(currentUser);
            }

            fetchHistory();
            updateProfileStats();
            return;
        } else {
            // Trường hợp không có Supabase session nhưng có user trong localStorage (Custom Auth)
            const savedUserStr = localStorage.getItem('agrisocial_user');
            if (savedUserStr) {
                const savedUser = JSON.parse(savedUserStr);
                currentUser = savedUser;
                if (!currentUser.id && currentUser.sub) currentUser.id = currentUser.sub;

                // Đồng bộ Profile để khớp Avatar
                try {
                    const { data: profile } = await window.supabaseClient
                        .from('profiles')
                        .select('*')
                        .eq('id', currentUser.id)
                        .single();
                    if (profile) currentUser.profile = profile;
                } catch (e) { console.error("Lỗi đồng bộ profile:", e); }

                updateAuthUI(currentUser);
                handleRoleBasedRedirect(currentUser);
            }
        }
    } catch (err) {
        console.error("Lỗi checkUser:", err);
    }
}

window.handleRoleBasedRedirect = async function (user) {
    if (!user) return false;
    if (localStorage.getItem('bypass_expert_redirect') === 'true') {
        return false;
    }
    const role = user.role || 'user';
    const currentPath = window.location.pathname;
    if (currentPath === '/' || currentPath.endsWith('index.html') || currentPath === '' || currentPath.includes('index.html')) {
        if (role === 'admin') { window.location.href = 'admin.html'; return true; }
        else if (role === 'expert') { window.location.href = 'expert.html'; return true; }
    }
    return false;
};

function updateAuthUI(user) {
    try {
        if (user) {
            document.body.classList.add('is-authenticated');
            document.documentElement.classList.add('is-authenticated');
            const p = user.profile || {};
            const m = user.user_metadata || {};
            const displayName = p.full_name || m.full_name || user.full_name || user.username || (user.email ? user.email.split('@')[0] : 'User');
            const avatarUrl = p.avatar_url || m.avatar_url || user.avatar_url;
            const mainAvatarUrl = avatarUrl || "https://i.pravatar.cc/150?u=" + user.id;

            const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
            setText('profile-name', displayName);
            setText('sidebar-name', displayName);
            setText('sidebar-handle', "@" + (user.username || (user.email ? user.email.split('@')[0] : 'user')));
            setText('drop-user-name', displayName);
            setText('drop-user-handle', "@" + (user.username || (user.email ? user.email.split('@')[0] : 'user')));
            setText('profile-bio', p.bio || m.bio || "Chưa có tiểu sử");

            const emailEl = document.getElementById('profile-email');
            if (emailEl) emailEl.innerHTML = `${user.email} <br><span style="color: #8b5cf6; font-weight: bold;">[Quyền: ${(p.role || m.role || user.role || 'user').toUpperCase()}]</span>`;

            const profileAvatar = document.getElementById('profile-avatar');
            if (profileAvatar) profileAvatar.innerHTML = `<img src="${mainAvatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;

            const profileCover = document.getElementById('profile-cover-img');
            if (profileCover) profileCover.src = p.cover_url || m.cover_url || "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80";

            document.querySelectorAll('[id$="avatar"]').forEach(img => {
                if (img.tagName === 'IMG') {
                    img.src = mainAvatarUrl;
                    img.style.display = 'block';
                }
            });

            setText('side-stat-post', p.stats?.posts || "0");
            setText('side-stat-follower', p.stats?.followers || "0");
            setText('side-stat-following', p.stats?.following || "0");

            const role = p.role || m.role || user.role || 'user';
            const btnExpert = document.getElementById('btn-feature-expert');
            if (btnExpert) btnExpert.style.display = (role === 'expert' || role === 'admin') ? 'flex' : 'none';
            const btnAdmin = document.getElementById('btn-feature-admin');
            if (btnAdmin) btnAdmin.style.display = (role === 'admin') ? 'flex' : 'none';

        } else if (!localStorage.getItem('agrisocial_token')) {
            document.body.classList.remove('is-authenticated');
            document.documentElement.classList.remove('is-authenticated');
        }

        if (document.documentElement.classList.contains('is-authenticated') || localStorage.getItem('agrisocial_token')) {
            const landing = document.getElementById('landing-page');
            if (landing) {
                landing.style.display = 'none'; landing.style.opacity = '0'; landing.style.pointerEvents = 'none';
            }
            document.body.style.overflow = 'auto';
        }
    } catch (e) { }
}

async function handleLogout() {
    if (window.supabaseClient && window.supabaseClient.auth) {
        try { await window.supabaseClient.auth.signOut(); } catch (e) { }
    }
    localStorage.removeItem('agrisocial_token');
    localStorage.removeItem('agrisocial_user');
    localStorage.removeItem('agrisocial_current_page');
    localStorage.removeItem('agrisocial_target_profile_id');
    localStorage.removeItem('bypass_expert_redirect');

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('agrisocial') || key.startsWith('sb-'))) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    document.cookie.split(";").forEach(function (c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    window.currentUser = null; window.postsCache = [];
    showToast("Đã đăng xuất thành công!", "success");
    window.location.href = 'index.html?logout=' + Date.now();
}

function resetUIState() {
    document.body.classList.remove('is-authenticated', 'is-expert', 'is-admin');
    const sidebarProfile = document.getElementById('sidebar-profile');
    if (sidebarProfile) sidebarProfile.innerHTML = '';
    document.querySelectorAll('.modal-overlay, .cmt-modal-overlay').forEach(m => m.style.display = 'none');
    document.body.style.overflow = 'auto';
}

function initAuth() {
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log("Supabase Auth Event:", event);
            if (session && session.user) {
                const u = session.user;
                const m = u.user_metadata || {};
                const displayName = m.full_name || (u.email ? u.email.split('@')[0] : 'User');

                currentUser = {
                    id: u.id,
                    email: u.email,
                    user_metadata: m,
                    profile: {
                        full_name: displayName,
                        role: m.role || 'user',
                        avatar_url: m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0d631b&color=fff`,
                        stats: { posts: 0, followers: 0, following: 0 }
                    }
                };

                localStorage.setItem('agrisocial_token', session.access_token);
                localStorage.setItem('agrisocial_user', JSON.stringify(currentUser));

                document.documentElement.classList.add('is-authenticated');
                document.body.classList.add('is-authenticated');

                const landing = document.getElementById('landing-page');
                if (landing) {
                    landing.style.setProperty('display', 'none', 'important');
                    landing.style.pointerEvents = 'none';
                }

                updateAuthUI(currentUser);
                checkUser();
            } else if (event === 'SIGNED_OUT') {
                document.documentElement.classList.remove('is-authenticated');
                document.body.classList.remove('is-authenticated');
            }
        });
    }

    const authModal = document.getElementById('auth-modal');
    const btnNavLogin = document.getElementById('btn-login');
    const btnCloseModal = document.querySelector('.close-modal');
    const authForm = document.getElementById('auth-form');
    const authSwitchLink = document.getElementById('auth-switch-link');
    let isLoginMode = true;

    if (btnNavLogin) btnNavLogin.onclick = () => authModal.style.display = 'flex';
    if (btnCloseModal) btnCloseModal.onclick = () => authModal.style.display = 'none';
    if (authModal) {
        authModal.onclick = (e) => {
            if (e.target === authModal) authModal.style.display = 'none';
        };
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-drop-login')) {
            isLoginMode = true; updateAuthModalUI(isLoginMode); authModal.style.display = 'flex';
        }
        if (e.target.classList.contains('btn-drop-register')) {
            isLoginMode = false; updateAuthModalUI(isLoginMode); authModal.style.display = 'flex';
        }
    });

    if (authSwitchLink) {
        authSwitchLink.onclick = (e) => {
            e.preventDefault(); isLoginMode = !isLoginMode; updateAuthModalUI(isLoginMode);
        };
    }

    function updateAuthModalUI(loginMode) {
        const title = document.querySelector('.auth-header h3');
        const submit = document.getElementById('btn-auth-submit');
        const switchText = document.getElementById('auth-switch-text');
        const switchLink = document.getElementById('auth-switch-link');
        const registerFields = document.querySelectorAll('.register-only');

        if (title) title.innerText = loginMode ? "ĐĂNG NHẬP" : "ĐĂNG KÝ TÀI KHOẢN";
        if (submit) submit.innerText = loginMode ? "ĐĂNG NHẬP" : "TẠO TÀI KHOẢN";
        if (switchText) switchText.innerText = loginMode ? "Chưa có tài khoản?" : "Đã có tài khoản?";
        if (switchLink) switchLink.innerText = loginMode ? "Đăng ký" : "Đăng nhập";
        registerFields.forEach(f => f.style.display = loginMode ? 'none' : 'block');
    }

    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            resetUIState();
            const emailOrUsername = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const btnSubmit = document.getElementById('btn-auth-submit');
            btnSubmit.disabled = true; btnSubmit.innerText = "Đang xử lý...";

            try {
                if (isLoginMode) {
                    const res = await fetch('/api/login', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: emailOrUsername, password })
                    });
                    const data = await res.json();
                    if (data.success) {
                        localStorage.setItem('agrisocial_token', data.token);
                        localStorage.setItem('agrisocial_user', JSON.stringify(data.user));
                        currentUser = data.user; currentUser.id = currentUser.sub;
                        showToast("Đăng nhập thành công!", "success");
                        authModal.style.display = 'none';
                        document.body.classList.add('is-authenticated');
                        updateAuthUI(currentUser);
                        const isRedirecting = await handleRoleBasedRedirect(currentUser);
                        if (!isRedirecting) location.reload();
                    } else {
                        if (emailOrUsername.includes('@')) {
                            const { error } = await window.supabaseClient.auth.signInWithPassword({ email: emailOrUsername, password });
                            if (error) throw error;
                            showToast("Đăng nhập Supabase thành công!", "success");
                            authModal.style.display = 'none'; checkUser();
                        } else {
                            throw new Error(data.error || "Tên đăng nhập hoặc mật khẩu không đúng");
                        }
                    }
                } else {
                    const lastName = document.getElementById('auth-lastname').value;
                    const firstName = document.getElementById('auth-firstname').value;
                    const confirmPassword = document.getElementById('auth-confirm-password').value;
                    if (password !== confirmPassword) { showToast("Mật khẩu xác nhận không khớp!", "error"); return; }
                    const fullName = `${lastName} ${firstName}`.trim();

                    const res = await fetch('/api/register', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: emailOrUsername, password, full_name: fullName })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast("Đăng ký thành công! Hãy đăng nhập.", "success");
                        isLoginMode = true; updateAuthModalUI(isLoginMode);
                    } else {
                        throw new Error(data.error || "Lỗi đăng ký");
                    }
                }
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btnSubmit.disabled = false; btnSubmit.innerText = isLoginMode ? "ĐĂNG NHẬP" : "ĐĂNG KÝ";
            }
        };
    }

    const btnLogout = document.getElementById('btn-logout-drop');
    if (btnLogout) {
        btnLogout.onclick = async () => { handleLogout(); };
    }
}

// ================================================================ //
// =================== CAMERA & SCANNING LOGIC ==================== //
// ================================================================ //

// Hàm helper nén ảnh trên client bằng HTML5 Canvas để tối ưu dung lượng tải lên
function compressImage(file, maxWidth = 1024, maxHeight = 1024) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(blob || file);
                }, 'image/jpeg', 0.75); // Nén định dạng JPEG chất lượng 75%
            };
            img.onerror = () => {
                resolve(file); // Fallback về file gốc nếu có lỗi tải ảnh
            };
        };
        reader.onerror = () => {
            resolve(file);
        };
    });
}

let listenersAttached = false;
function setupEventListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    const useNativeCamera = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera);

    async function openNativeGallery() {
        if (!currentUser) {
            showToast("Vui lòng đăng nhập để sử dụng tính năng tải ảnh nhận diện!", "info");
            document.getElementById('auth-modal').style.display = 'flex';
            return;
        }
        try {
            playTone(300, 'square', 0.1);
            const Camera = window.Capacitor.Plugins.Camera;
            const image = await Camera.getPhoto({
                quality: 70,
                allowEditing: false,
                resultType: 'uri',
                source: 'PHOTOS',
                width: 1024,
                height: 1024,
                correctOrientation: true
            });

            if (image && image.webPath) {
                const res = await fetch(image.webPath);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);

                imgPreview.src = url;
                imgPreview.style.display = 'block';
                if (video) video.style.display = 'none';
                if (heatmapImg) heatmapImg.style.display = 'none';
                if (radarAnim) radarAnim.style.display = 'none';
                if (placeholder) placeholder.style.display = 'none';

                analyzeImage(blob, url, "Gallery_Select.jpg");
            }
        } catch (err) {
            console.log("Native Gallery Cancelled or Failed:", err);
        }
    }

    // Định nghĩa hàm toàn cục để trigger thư viện ảnh từ HTML
    window.triggerPhotoLibrary = async function () {
        if (!currentUser) {
            showToast("Vui lòng đăng nhập để sử dụng tính năng tải ảnh nhận diện!", "info");
            document.getElementById('auth-modal').style.display = 'flex';
            return;
        }
        if (useNativeCamera) {
            await openNativeGallery();
        } else {
            if (fileUpload) {
                fileUpload.click();
            }
        }
    };

    if (btnCamera) {
        btnCamera.addEventListener('click', async () => {
            if (!currentUser) {
                showToast("Vui lòng đăng nhập để sử dụng tính năng quét cây!", "info");
                document.getElementById('auth-modal').style.display = 'flex';
                return;
            }
            initAudio();

            if (useNativeCamera) {
                try {
                    playTone(300, 'square', 0.1);
                    const Camera = window.Capacitor.Plugins.Camera;
                    const image = await Camera.getPhoto({
                        quality: 70,
                        allowEditing: false,
                        resultType: 'uri',
                        source: 'CAMERA',
                        width: 1024,
                        height: 1024,
                        correctOrientation: true
                    });

                    if (image && image.webPath) {
                        const res = await fetch(image.webPath);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);

                        imgPreview.src = url;
                        imgPreview.style.display = 'block';
                        if (video) video.style.display = 'none';
                        if (heatmapImg) heatmapImg.style.display = 'none';
                        if (radarAnim) radarAnim.style.display = 'none';
                        if (placeholder) placeholder.style.display = 'none';

                        analyzeImage(blob, url, "Camera_Capture.jpg");
                    }
                } catch (err) {
                    console.log("Native Camera Cancelled or Failed:", err);
                }
            } else {
                try {
                    if (stream) { stopCamera(); return; }
                    // Switch to page-camera tab only on web/fallback
                    if (typeof switchTab === 'function') {
                        switchTab('page-camera');
                    }
                    playTone(300, 'square', 0.1);
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    } catch (e) {
                        stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    }
                    video.srcObject = stream; video.style.display = 'block';
                    imgPreview.style.display = 'none'; heatmapImg.style.display = 'none';
                    if (radarAnim) radarAnim.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'none';
                    btnCamera.innerHTML = '🛑 Tắt Camera';
                    if (btnCapture) btnCapture.style.display = 'inline-flex';
                    scannerBox.classList.add('active');
                } catch (err) {
                    alert("Lỗi Camera. Vui lòng kiểm tra lại quyền truy cập.");
                }
            }
        });
    }

    if (btnCapture) {
        btnCapture.addEventListener('click', () => {
            if (!stream) return;
            initAudio(); playTone(800, 'triangle', 0.1);
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                imgPreview.src = url; imgPreview.style.display = 'block';
                video.style.display = 'none'; stopCamera();
                analyzeImage(blob, url, "Ảnh chụp từ Camera");
            }, 'image/jpeg', 0.9);
        });
    }

    if (fileUpload) {
        fileUpload.addEventListener('change', async (e) => {
            if (!currentUser) {
                showToast("Vui lòng đăng nhập để sử dụng tính năng tải ảnh nhận diện!", "info");
                document.getElementById('auth-modal').style.display = 'flex';
                e.target.value = ''; return;
            }
            initAudio();
            const file = e.target.files[0];
            if (!file) return;
            stopCamera();

            try {
                // Nén và resize ảnh trước khi phân tích
                const compressedBlob = await compressImage(file);
                const url = URL.createObjectURL(compressedBlob);
                imgPreview.src = url; imgPreview.style.display = 'block';
                heatmapImg.style.display = 'none';
                if (radarAnim) radarAnim.style.display = 'none';
                if (placeholder) placeholder.style.display = 'none';
                analyzeImage(compressedBlob, url, file.name);
            } catch (compressErr) {
                console.error("Lỗi nén ảnh, dùng ảnh gốc làm fallback:", compressErr);
                const url = URL.createObjectURL(file);
                imgPreview.src = url; imgPreview.style.display = 'block';
                heatmapImg.style.display = 'none';
                if (radarAnim) radarAnim.style.display = 'none';
                if (placeholder) placeholder.style.display = 'none';
                analyzeImage(file, url, file.name);
            }
        });
    }
}

function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video) video.style.display = 'none';
    if (radarAnim) radarAnim.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    if (btnCamera) {
        btnCamera.innerHTML = '<span class="icon">📷</span> Bật Camera';
        if (btnCapture) btnCapture.style.display = 'none';
    }
    if (scannerBox) scannerBox.classList.remove('active');
}

async function analyzeImage(blob, imgUrl, fileName = 'Image.jpg') {
    if (!currentUser) return;

    // Switch to Scanning UI
    if (typeof switchTab === 'function') {
        switchTab('page-ai-scanning');
    }

    const scanningImg = document.getElementById('scanning-img-preview');
    if (scanningImg) scanningImg.src = imgUrl;

    const scanningFileName = document.getElementById('scanning-filename');
    if (scanningFileName) scanningFileName.innerText = fileName;

    // --- LẤY TỌA ĐỘ GPS THỰC TẾ ---
    let lat = window.userLat || parseFloat(localStorage.getItem('user_lat')) || null;
    let lng = window.userLng || parseFloat(localStorage.getItem('user_lng')) || null;

    const formData = new FormData();
    formData.append('file', blob, 'capture.jpg');
    if (currentUser && currentUser.id) formData.append('user_id', currentUser.id);
    if (lat !== null) formData.append('lat', lat);
    if (lng !== null) formData.append('lng', lng);

    try {
        const response = await fetch('/predict', { method: 'POST', body: formData });
        const data = await response.json();
        console.log("AI Response Data received:", data);

        // Cập nhật thanh tiến trình lên 100% khi nhận được phản hồi
        const scanProgressBar = document.querySelector('#page-ai-scanning .bg-primary.h-full');
        if (scanProgressBar) {
            scanProgressBar.classList.remove('animate-pulse');
            scanProgressBar.style.width = '100%';
        }

        if (data.success) {
            console.log("Prediction success! Transitioning to result page...");

            // Cập nhật Heatmap nếu có
            if (data.details && data.details.heatmap) {
                const h1 = document.getElementById('heatmap-img');
                const h2 = document.getElementById('c-heatmap-img');
                if (h1) h1.src = data.details.heatmap;
                if (h2) h2.src = data.details.heatmap;
            }

            // Gọi cập nhật bách khoa toàn thư và chuyển tab
            updateEncyclopedia(data);

            // Tải lại lịch sử sau một khoảng trễ ngắn
            setTimeout(fetchHistory, 500);

            // --- LƯU DỮ LIỆU THỰC TẾ VÀO DATABASE (Vô hiệu hóa vì bảng crop_locations chưa tồn tại trong Supabase) ---
            /*
            if (lat && lng && window.supabaseClient && currentUser && currentUser.id) {
                const cropType = data.details?.vi || data.prediction;
                try {
                    window.supabaseClient.from('crop_locations').insert([
                        {
                            user_id: currentUser.id,
                            crop_type: cropType,
                            lat: lat,
                            lng: lng,
                            created_at: new Date().toISOString()
                        }
                    ]).then(({ error }) => {
                        if (error) console.warn("Lỗi lưu vị trí (có thể bảng crop_locations chưa tồn tại):", error);
                        else console.log("Real location saved to Map!");
                    });
                } catch (e) {
                    console.warn("Không thể lưu vị trí vào database:", e);
                }
            }
            */

        } else {
            // Nếu lỗi do không nhận diện được cây lương thực, chuyển sang Tab Cảnh báo chuyên dụng
            if (data.error && data.error.includes("không phải cây lương thực")) {
                if (typeof switchTab === 'function') switchTab('page-ai-error');
            } else {
                if (typeof showToast === 'function') showToast(data.error, "error");
                else alert("Lỗi AI: " + data.error);

                if (typeof switchTab === 'function') switchTab('page-ai-home');
            }
        }
    } catch (err) {
        if (typeof showToast === 'function') showToast("Lỗi kết nối Máy chủ AI.", "error");
        else alert("Lỗi kết nối Máy chủ AI.");

        if (typeof switchTab === 'function') switchTab('page-ai-home');
    }
}

// --- Bounding Box Drawing Engine & Resize Listener ---
window.drawBoundingBoxes = function (boxes, label, severity) {
    const canvas = document.getElementById('c-bbox-canvas');
    if (!canvas) return;
    const img = document.getElementById('c-result-img');
    if (!img) return;

    // Canvas dimensions must match the image's displayed dimensions
    const rect = img.getBoundingClientRect();
    canvas.width = img.clientWidth || rect.width || img.width;
    canvas.height = img.clientHeight || rect.height || img.height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!boxes || boxes.length === 0) return;

    // Severity Color HSL
    const color = severity === 'Critical' ? '#EF4444' : severity === 'Warning' ? '#F59E0B' : '#10B981';

    boxes.forEach(box => {
        const [rx, ry, rw, rh] = box;
        const x = rx * canvas.width;
        const y = ry * canvas.height;
        const w = rw * canvas.width;
        const h = rh * canvas.height;

        // Draw box border (dashed/pulsing look)
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x, y, w, h);

        // Draw solid background for the top tag
        ctx.fillStyle = color;
        ctx.font = 'bold 10px sans-serif';
        const labelText = `${label} (${severity})`;
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillRect(x, y - 16 > 0 ? y - 16 : 0, textWidth + 10, 16);

        // Write tag text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(labelText, x + 5, (y - 16 > 0 ? y - 16 : 0) + 12);
    });
};

window.addEventListener('resize', () => {
    const canvas = document.getElementById('c-bbox-canvas');
    if (canvas && !canvas.classList.contains('hidden') && currentResult && currentResult.details && currentResult.details.disease) {
        const disease = currentResult.details.disease;
        drawBoundingBoxes(disease.bounding_boxes, disease.disease_vi, disease.severity);
    }
});

function updateEncyclopedia(data) {
    try {
        console.log("Updating Encyclopedia with data:", data);
        currentResult = data;

        // Chuyển sang tab kết quả
        if (typeof switchTab === 'function') {
            switchTab('page-ai-result');
        }

        const details = data.details || {};
        const safeSet = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
        const safeHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

        // 1. Ảnh & Heatmap & Bounding Box Setup
        const resultImg = document.getElementById('c-result-img');
        if (resultImg && data.image_url) {
            resultImg.src = data.image_url;
        }

        const heatmapImg = document.getElementById('c-heatmap-img');
        const bboxCanvas = document.getElementById('c-bbox-canvas');
        const viewToggles = document.getElementById('c-view-toggles');

        // Reset overlays and view toggles
        if (heatmapImg) heatmapImg.classList.add('hidden');
        if (bboxCanvas) {
            bboxCanvas.classList.add('hidden');
            const ctx = bboxCanvas.getContext('2d');
            ctx.clearRect(0, 0, bboxCanvas.width, bboxCanvas.height);
        }
        if (viewToggles) viewToggles.classList.add('hidden');

        // Báo cáo chẩn đoán bệnh học
        const disease = details.disease || null;

        if (disease) {
            // Hiển thị cụm nút Toggles
            if (viewToggles) viewToggles.classList.remove('hidden');

            const btnOriginal = document.getElementById('btn-toggle-original');
            const btnHeatmap = document.getElementById('btn-toggle-heatmap');
            const btnBbox = document.getElementById('btn-toggle-bbox');

            // Hàm làm mới trạng thái nút nhấn
            const resetBtnStyles = () => {
                [btnOriginal, btnHeatmap, btnBbox].forEach(btn => {
                    if (btn) {
                        btn.className = "bg-black/40 backdrop-blur-sm text-white/80 px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold hover:bg-black/60 transition-all border border-white/10 active:scale-95";
                    }
                });
            };

            const selectBtn = (btn) => {
                if (btn) {
                    btn.className = "bg-primary text-on-primary px-3 py-1.5 rounded-full text-[10px] md:text-xs font-black shadow transition-all border border-white/10 active:scale-95";
                }
            };

            // Thiết lập sự kiện click
            if (btnOriginal) {
                btnOriginal.onclick = () => {
                    resetBtnStyles();
                    selectBtn(btnOriginal);
                    if (heatmapImg) heatmapImg.classList.add('hidden');
                    if (bboxCanvas) bboxCanvas.classList.add('hidden');
                };
            }

            if (btnHeatmap) {
                if (details.heatmap) {
                    heatmapImg.src = details.heatmap;
                    btnHeatmap.classList.remove('hidden');
                    btnHeatmap.onclick = () => {
                        resetBtnStyles();
                        selectBtn(btnHeatmap);
                        if (heatmapImg) heatmapImg.classList.remove('hidden');
                        if (bboxCanvas) bboxCanvas.classList.add('hidden');
                    };
                } else {
                    btnHeatmap.classList.add('hidden');
                }
            }

            if (btnBbox) {
                if (disease.bounding_boxes && disease.bounding_boxes.length > 0) {
                    btnBbox.classList.remove('hidden');
                    btnBbox.onclick = () => {
                        resetBtnStyles();
                        selectBtn(btnBbox);
                        if (heatmapImg) heatmapImg.classList.add('hidden');
                        if (bboxCanvas) {
                            bboxCanvas.classList.remove('hidden');
                            drawBoundingBoxes(disease.bounding_boxes, disease.disease_vi, disease.severity);
                        }
                    };
                } else {
                    btnBbox.classList.add('hidden');
                }
            }

            // Mặc định: Nếu có bounding boxes thì kích hoạt chế độ vẽ vết bệnh đầu tiên cho ngầu!
            if (disease.bounding_boxes && disease.bounding_boxes.length > 0) {
                setTimeout(() => {
                    if (btnBbox) btnBbox.click();
                }, 300);
            } else {
                if (btnOriginal) btnOriginal.click();
            }
        }

        // Header Info
        safeSet('c-name', details.vi || data.prediction);
        safeSet('c-sci', details.ten_khoa_hoc || "Scientific name pending...");
        safeSet('c-desc', details.mo_ta || "Đang cập nhật mô tả chi tiết cho loại cây này...");

        // 2. Chẩn đoán bệnh học UI Cards setup
        const diseaseCard = document.getElementById('c-disease-card');
        const healthyCard = document.getElementById('c-healthy-card');

        if (diseaseCard) diseaseCard.classList.add('hidden');
        if (healthyCard) healthyCard.classList.add('hidden');

        if (disease) {
            if (disease.key === 'healthy') {
                if (healthyCard) healthyCard.classList.remove('hidden');
            } else {
                if (diseaseCard) {
                    diseaseCard.classList.remove('hidden');

                    // Cập nhật thông tin chi tiết thẻ
                    safeSet('c-disease-type', `Phát hiện trên bộ phận: ${details.vi || data.prediction}`);

                    const severity = disease.severity || 'Low';
                    const severityBadge = document.getElementById('c-disease-severity-badge');
                    if (severityBadge) {
                        severityBadge.innerText = severity.toUpperCase();
                        if (severity === 'Critical') {
                            severityBadge.className = "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse border bg-red-50 text-red-600 border-red-200";
                        } else if (severity === 'Warning') {
                            severityBadge.className = "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse border bg-amber-50 text-amber-600 border-amber-200";
                        } else {
                            severityBadge.className = "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-200";
                        }
                    }

                    const diseaseDescText = `Hệ thống phân tích phát hiện cây trồng đang nhiễm **${disease.disease_vi}** (${disease.disease_en}) với tỷ lệ diện tích tổn thương thuộc phân nhóm cảnh báo **${severity}**. ${details.meo_chuyen_gia || ''}`;
                    safeHtml('c-disease-desc', diseaseDescText);

                    // Helper format thuốc hóa học
                    const formatTreatmentItem = (item) => {
                        if (typeof item === 'object' && item !== null) {
                            return `<strong>${item.name}</strong> (Liều lượng khuyến nghị: ${item.dosage}, Tần suất: ${item.interval})<br><span class="opacity-80 font-medium text-[11px] block mt-0.5">💡 Lưu ý chuyên gia: ${item.note}</span>`;
                        }
                        return String(item);
                    };

                    // Điền danh sách
                    const fillList = (id, items) => {
                        const el = document.getElementById(id);
                        if (el) {
                            if (items && Array.isArray(items) && items.length > 0) {
                                el.innerHTML = items.map(item => `<li class="mb-1">${formatTreatmentItem(item)}</li>`).join('');
                            } else {
                                el.innerHTML = '<li class="text-on-surface-variant italic">Đang cập nhật phác đồ...</li>';
                            }
                        }
                    };

                    fillList('c-disease-emergency', disease.treatment.emergency);
                    fillList('c-disease-chemical', disease.treatment.chemical);
                    fillList('c-disease-biological', disease.treatment.biological);
                    fillList('c-disease-prevention', disease.treatment.prevention);
                }
            }
        }

        const probPct = (data.probability * 100).toFixed(1);
        safeSet('c-prob', `Độ chính xác: ${probPct}%`);
        safeSet('c-badge', "Cây Lương Thực");

        // Scientific Classification
        safeSet('c-order', details.bo || "Poales");
        safeSet('c-family', details.ho || "Poaceae");
        safeSet('c-genus', details.chi || "Unknown");
        safeSet('c-species', details.loai || "Unknown");

        // Biological Attributes
        if (details.thuoc_tinh) {
            safeSet('c-type', details.thuoc_tinh.loai_cay || "Đang cập nhật");
            safeSet('c-time', details.thuoc_tinh.thoi_gian || "Đang cập nhật");
            safeSet('c-height', details.thuoc_tinh.chieu_cao || "Đang cập nhật");
            safeSet('c-habitat', details.thuoc_tinh.moi_truong || "Đang cập nhật");
            safeSet('c-color-leaf', `Lá: ${details.thuoc_tinh.mau_la || "Xanh"}`);
            safeSet('c-color-special', details.thuoc_tinh.mau_dac_trung || "Đang cập nhật");
        }

        // Growing Conditions
        if (details.dieu_kien) {
            safeSet('c-water', details.dieu_kien.nuoc || "Đang cập nhật");
            safeSet('c-sun', details.dieu_kien.anh_sang || "Đang cập nhật");
            safeSet('c-soil', details.dieu_kien.dat || "Đang cập nhật");
        }

        // Pests & Diseases
        const pestsList = document.getElementById('c-pests-list');
        if (pestsList) {
            if (details.sau_benh && Array.isArray(details.sau_benh) && details.sau_benh.length > 0) {
                pestsList.innerHTML = details.sau_benh.map(pest => `
                <li class="bg-error-container/20 p-3 rounded-lg border border-error/20">
                    <h4 class="font-label-lg text-label-lg text-error font-bold flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[16px]">pest_control</span> ${pest.ten}
                    </h4>
                    <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 ml-6">${pest.mo_ta}</p>
                </li>
            `).join('');
            } else {
                pestsList.innerHTML = '<li class="text-on-surface-variant text-sm italic">Không có cảnh báo sâu bệnh</li>';
            }
        }

        // Expert Tips & Usage
        safeHtml('c-expert-tip', `<strong>Mẹo:</strong> ${details.meo_chuyen_gia || "Đang cập nhật..."}`);
        safeHtml('c-usage', `<strong>Ứng dụng:</strong> ${details.ung_dung || "Đang cập nhật..."}`);

        // Story & Symbolism & Fun Fact
        safeSet('c-story', details.cau_chuyen || "Đang cập nhật câu chuyện...");
        safeSet('c-symbol', details.bieu_tuong || "Đang cập nhật biểu tượng...");
        safeSet('c-fact', details.su_that || "Đang cập nhật sự thật thú vị...");

        // Gallery / Thumbnails
        const galleryContainer = document.getElementById('c-gallery-container');
        if (galleryContainer) {
            let galleryHtml = '';

            // Add the user's uploaded image as the first thumbnail
            if (data.image_url) {
                galleryHtml += `
                <div class="relative w-20 h-20 rounded-lg flex-shrink-0 snap-start border-2 border-primary cursor-pointer hover:opacity-80 transition-opacity overflow-hidden" 
                     onclick="document.getElementById('c-result-img').src='${data.image_url}'; const hm = document.getElementById('c-heatmap-img'); if(hm && '${details.heatmap || ''}') hm.classList.remove('hidden');">
                    <img src="${data.image_url}" class="w-full h-full object-cover">
                    <div class="absolute top-1 right-1 bg-primary text-on-primary rounded-full w-5 h-5 flex items-center justify-center">
                        <span class="material-symbols-outlined text-[12px]">crop_free</span>
                    </div>
                </div>
            `;
            }

            if (details.gallery && Array.isArray(details.gallery)) {
                galleryHtml += details.gallery.map(imgUrl => `
                <img src="${imgUrl}" onclick="document.getElementById('c-result-img').src='${imgUrl}'; const hm = document.getElementById('c-heatmap-img'); if(hm) hm.classList.add('hidden');" class="w-20 h-20 rounded-lg object-cover flex-shrink-0 snap-start border border-outline-variant cursor-pointer hover:opacity-80 transition-opacity">
            `).join('');
            }
            galleryHtml += `
            <div class="w-20 h-20 rounded-lg bg-surface-container flex flex-col items-center justify-center flex-shrink-0 snap-start border border-outline-variant cursor-pointer hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <span class="material-symbols-outlined">add_photo_alternate</span>
                <span class="font-label-md text-[10px] mt-1">Thêm</span>
            </div>
        `;
            galleryContainer.innerHTML = galleryHtml;
        }

        // Trigger các logic cũ
        triggerRiskAlert(data.prediction);
        const cropKey = data.prediction.startsWith('sweet_potato') ? 'sweet_potato' : data.prediction.split('_')[0];
        loadTreatments(cropKey);
        loadWeatherAlerts();

        const btnExpert = document.getElementById('btn-ask-expert');
        if (btnExpert) btnExpert.onclick = openExpertModal;

        if (data.probability < 0.50) {
            setTimeout(() => {
                const wantExpert = confirm("AI nhận diện với độ tin cậy thấp. Bạn có muốn gửi ảnh này cho Chuyên gia tư vấn không?");
                if (wantExpert) openExpertModal();
            }, 1500);
        }
    } catch (err) {
        console.error("Lỗi khi cập nhật giao diện kết quả:", err);
    }
}

// =========================================================
// 🚀 TÍNH NĂNG CHUYÊN GIA (EXPERT Q&A)
// =========================================================

window.currentQnAFilter = 'all';
window.currentQnAStatusFilter = 'all';
window.currentQnAPage = 1;

window.filterExpertQnA = function (filter, btnElement) {
    window.currentQnAFilter = filter;
    window.currentQnAStatusFilter = 'all'; // reset status filter when category changes
    window.currentQnAPage = 1; // reset page when filters change

    if (btnElement) {
        document.querySelectorAll('.qna-filter-btn').forEach(btn => {
            btn.classList.remove('bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'active');
            btn.classList.add('bg-surface', 'text-on-surface-variant', 'border', 'border-outline-variant');
        });
        btnElement.classList.remove('bg-surface', 'text-on-surface-variant', 'border', 'border-outline-variant');
        btnElement.classList.add('bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'active');
    }

    const feed = document.getElementById('expert-qna-feed');
    if (feed) feed.innerHTML = '<div class="p-8 text-center text-on-surface-variant"><span class="material-symbols-outlined animate-spin text-primary">autorenew</span> Đang tải dữ liệu...</div>';

    fetchExpertQnA(true); // pass true to skip reloading experts/stats to save bandwidth
};

window.filterAnsweredQnA = function () {
    window.currentQnAStatusFilter = 'answered';
    window.currentQnAFilter = 'all'; // reset crop filter to show all answered
    window.currentQnAPage = 1; // reset page when filters change

    // Sync active state on category filter buttons (highlight "Tất cả")
    document.querySelectorAll('.qna-filter-btn').forEach(btn => {
        btn.classList.remove('bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'active');
        btn.classList.add('bg-surface', 'text-on-surface-variant', 'border', 'border-outline-variant');
    });

    // Find and highlight "Tất cả" button
    document.querySelectorAll('.qna-filter-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'all'")) {
            btn.classList.remove('bg-surface', 'text-on-surface-variant', 'border', 'border-outline-variant');
            btn.classList.add('bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'active');
        }
    });

    const feed = document.getElementById('expert-qna-feed');
    if (feed) feed.innerHTML = '<div class="p-8 text-center text-on-surface-variant"><span class="material-symbols-outlined animate-spin text-primary">autorenew</span> Đang tải dữ liệu...</div>';

    fetchExpertQnA(true);
};

window.filterTotalQnA = function () {
    window.currentQnAStatusFilter = 'all';
    window.currentQnAFilter = 'all'; // reset crop filter to show all
    window.currentQnAPage = 1; // reset page when filters change

    // Sync active state on category filter buttons (highlight "Tất cả")
    document.querySelectorAll('.qna-filter-btn').forEach(btn => {
        btn.classList.remove('bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'active');
        btn.classList.add('bg-surface', 'text-on-surface-variant', 'border', 'border-outline-variant');
    });

    // Find and highlight "Tất cả" button
    document.querySelectorAll('.qna-filter-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'all'")) {
            btn.classList.remove('bg-surface', 'text-on-surface-variant', 'border', 'border-outline-variant');
            btn.classList.add('bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'active');
        }
    });

    const feed = document.getElementById('expert-qna-feed');
    if (feed) feed.innerHTML = '<div class="p-8 text-center text-on-surface-variant"><span class="material-symbols-outlined animate-spin text-primary">autorenew</span> Đang tải dữ liệu...</div>';

    fetchExpertQnA(true);
};

window.filterPendingQnA = function () {
    window.currentQnAStatusFilter = 'pending';
    window.currentQnAFilter = 'all'; // reset crop filter to show all pending
    window.currentQnAPage = 1; // reset page when filters change

    // Sync active state on category filter buttons (highlight "Tất cả")
    document.querySelectorAll('.qna-filter-btn').forEach(btn => {
        btn.classList.remove('bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'active');
        btn.classList.add('bg-surface', 'text-on-surface-variant', 'border', 'border-outline-variant');
    });

    // Find and highlight "Tất cả" button
    document.querySelectorAll('.qna-filter-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'all'")) {
            btn.classList.remove('bg-surface', 'text-on-surface-variant', 'border', 'border-outline-variant');
            btn.classList.add('bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'active');
        }
    });

    const feed = document.getElementById('expert-qna-feed');
    if (feed) feed.innerHTML = '<div class="p-8 text-center text-on-surface-variant"><span class="material-symbols-outlined animate-spin text-primary">autorenew</span> Đang tải dữ liệu...</div>';

    fetchExpertQnA(true);
};


window.changeQnAPage = function (page) {
    window.currentQnAPage = page;
    const feed = document.getElementById('expert-qna-feed');
    if (feed) feed.innerHTML = '<div class="p-8 text-center text-on-surface-variant"><span class="material-symbols-outlined animate-spin text-primary">autorenew</span> Đang tải dữ liệu...</div>';
    fetchExpertQnA(true);

    // Smooth scroll to Q&A filter bar
    const filterBar = document.getElementById('expert-qna-filters');
    if (filterBar) {
        filterBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

window.renderQnAPagination = function (totalCount) {
    const paginationContainer = document.getElementById('expert-qna-pagination');
    if (!paginationContainer) return;

    const QNA_PAGE_SIZE = 10;
    const totalPages = Math.ceil(totalCount / QNA_PAGE_SIZE);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '<div class="flex justify-center items-center gap-6 mt-6 pb-4">';

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === window.currentQnAPage;
        if (isActive) {
            html += `
                <div class="flex flex-col items-center justify-between h-[36px] min-w-[24px]">
                    <span class="text-base font-bold text-gray-800 cursor-default leading-none pt-1">${i}</span>
                    <div class="w-6 h-[3px] bg-gray-800 rounded-full"></div>
                </div>
            `;
        } else {
            html += `
                <button onclick="window.changeQnAPage(${i})" class="text-base font-medium text-gray-400 hover:text-gray-800 transition-colors h-[36px] min-w-[24px] flex flex-col items-center justify-start leading-none pt-1">
                    ${i}
                </button>
            `;
        }
    }

    // Next chevron button
    if (window.currentQnAPage < totalPages) {
        html += `
            <button onclick="window.changeQnAPage(${window.currentQnAPage + 1})" class="text-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center h-[36px] min-w-[24px] pt-1">
                <span class="material-symbols-outlined text-xl">chevron_right</span>
            </button>
        `;
    }

    html += '</div>';
    paginationContainer.innerHTML = html;
};

window.fetchExpertQnA = async function (skipStats = false) {
    const feed = document.getElementById('expert-qna-feed');
    const expertList = document.getElementById('top-experts-list');
    const statsAns = document.getElementById('expert-stats-answered');
    const statsTotal = document.getElementById('expert-stats-total');
    const statsPending = document.getElementById('expert-stats-pending');
    const statsOnline = document.getElementById('expert-stats-online');

    if (!feed || !window.supabaseClient) return;

    try {
        if (!skipStats) {
            // 1. Lấy chuyên gia (Top Experts)
<<<<<<< HEAD
            try {
                const resExp = await fetch('/api/experts/top');
                const expData = await resExp.json();
                const allExperts = expData.data || [];
                const experts = allExperts.slice(0, 3);

                if (experts && experts.length > 0) {
                    if (statsOnline) statsOnline.innerText = experts.length;

                    if (expertList) {
                        expertList.innerHTML = experts.map((exp, idx) => `
                            <div class="flex items-center gap-3 cursor-pointer hover:bg-surface-container-lowest transition-colors p-2 rounded-xl" onclick="window.targetProfileId='${exp.id}'; switchTab('page-profile');">
                                <div class="relative">
                                    <img alt="Expert Avatar" class="w-12 h-12 rounded-full object-cover" src="${exp.avatar_url || 'https://i.pravatar.cc/150?u=' + exp.id}"/>
                                    <span class="absolute bottom-0 right-0 w-3 h-3 ${idx === 0 ? 'bg-secondary-container' : 'bg-surface-variant'} border-2 border-surface-container-lowest rounded-full"></span>
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-label-lg text-label-lg text-on-background">${exp.full_name}</h4>
                                    <p class="font-label-md text-label-md text-on-surface-variant mb-1 hidden">@${exp.username || 'chuyengia'}</p>
                                    ${exp.rating > 0 ? `
                                    <div class="flex items-center gap-1">
                                        <span class="font-label-md text-amber-500 font-bold">${exp.rating.toFixed(1)}</span>
                                        <div class="flex text-amber-400">
                                            <svg class="w-3.5 h-3.5 fill-amber-400 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                        </div>
                                        <span class="text-[11px] text-slate-500 font-medium ml-0.5">(${exp.rating_count || 0})</span>
                                    </div>
                                    ` : `<span class="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Chưa có đánh giá</span>`}
                                </div>
                                <button onclick="event.stopPropagation(); askSpecificExpert('${exp.id}');" class="text-primary border border-primary font-label-md text-label-md px-3 py-1 rounded-full hover:bg-surface-container-low transition-colors">Tư vấn</button>
                            </div>
                        `).join('');
                    }
                }
            } catch (err) {
                console.error("Lỗi lấy chuyên gia nổi bật", err);
=======
            const { data: experts, error: expErr } = await window.supabaseClient
                .from('profiles')
                .select('id, full_name, avatar_url, role, username')
                .eq('role', 'expert')
                .limit(3);

            if (experts) {
                if (statsOnline) statsOnline.innerText = experts.length;

                if (expertList) {
                    expertList.innerHTML = experts.map((exp, idx) => `
                        <div class="flex items-center gap-3 cursor-pointer hover:bg-surface-container-lowest transition-colors p-2 rounded-xl" onclick="window.targetProfileId='${exp.id}'; switchTab('page-profile');">
                            <div class="relative">
                                <img alt="Expert Avatar" class="w-12 h-12 rounded-full object-cover" src="${exp.avatar_url || 'https://i.pravatar.cc/150?u=' + exp.id}"/>
                                <span class="absolute bottom-0 right-0 w-3 h-3 ${idx === 0 ? 'bg-secondary-container' : 'bg-surface-variant'} border-2 border-surface-container-lowest rounded-full"></span>
                            </div>
                            <div class="flex-1">
                                <h4 class="font-label-lg text-label-lg text-on-background">${exp.full_name}</h4>
                                <p class="font-label-md text-label-md text-on-surface-variant">@${exp.username || 'chuyengia'}</p>
                            </div>
                            <button onclick="event.stopPropagation(); askSpecificExpert('${exp.id}');" class="text-primary border border-primary font-label-md text-label-md px-3 py-1 rounded-full hover:bg-surface-container-low transition-colors">Tư vấn</button>
                        </div>
                    `).join('');
                }
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
            }

            // Lấy tổng số câu đã giải đáp
            const { count: reqCount } = await window.supabaseClient
                .from('expert_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'answered');
            if (statsAns) statsAns.innerText = reqCount || "0";

            // Lấy tổng số câu chưa giải đáp
            const { count: pendingCount } = await window.supabaseClient
                .from('expert_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            if (statsPending) statsPending.innerText = pendingCount || "0";

            // Lấy tổng số câu hỏi
            const { count: totalCount } = await window.supabaseClient
                .from('expert_requests')
                .select('*', { count: 'exact', head: true });
            if (statsTotal) statsTotal.innerText = totalCount || "0";
        }

        // 2. Lấy câu hỏi Q&A Feed (Có Filter & Phân trang)
        const QNA_PAGE_SIZE = 10;
        const from = (window.currentQnAPage - 1) * QNA_PAGE_SIZE;
        const to = from + QNA_PAGE_SIZE - 1;

        // Đếm tổng số bản ghi
        let countQuery = window.supabaseClient
            .from('expert_requests')
            .select('*', { count: 'exact', head: true });

        if (window.currentQnAFilter && window.currentQnAFilter !== 'all') {
            countQuery = countQuery.or(`ai_prediction.ilike.%${window.currentQnAFilter}%,user_note.ilike.%${window.currentQnAFilter}%`);
        }
        if (window.currentQnAStatusFilter && window.currentQnAStatusFilter !== 'all') {
            countQuery = countQuery.eq('status', window.currentQnAStatusFilter);
        }
        const { count: totalQnA } = await countQuery;

        // Lấy dữ liệu theo trang
        let query = window.supabaseClient
            .from('expert_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (window.currentQnAFilter && window.currentQnAFilter !== 'all') {
            query = query.or(`ai_prediction.ilike.%${window.currentQnAFilter}%,user_note.ilike.%${window.currentQnAFilter}%`);
        }

        if (window.currentQnAStatusFilter && window.currentQnAStatusFilter !== 'all') {
            query = query.eq('status', window.currentQnAStatusFilter);
        }

        const { data: requests, error: reqErr } = await query;
        if (reqErr) throw reqErr;
        window.currentExpertRequests = requests;

        if (requests && requests.length > 0) {
            // Lấy danh sách user_id duy nhất
            const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
            let profilesMap = {};

            if (userIds.length > 0) {
                try {
                    const { data: profiles, error: profErr } = await window.supabaseClient
                        .from('profiles')
                        .select('id, full_name, avatar_url, username')
                        .in('id', userIds);
                    if (!profErr && profiles) {
                        profiles.forEach(p => {
                            profilesMap[p.id] = p;
                        });
                    }
                } catch (pe) {
                    console.error("Lỗi khi tải thông tin user profiles cho Q&A:", pe);
                }
            }

            if (feed) {
                // Render pagination controls
                window.renderQnAPagination(totalQnA || 0);
                feed.innerHTML = requests.map(req => {
                    const profile = profilesMap[req.user_id] || {};
                    const isAnswered = req.status === 'answered';

                    // Tính thời gian
                    const createdDate = new Date(req.created_at);
                    const diff = new Date() - createdDate;
                    const diffHours = Math.floor(diff / (1000 * 60 * 60));
                    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
                    let timeStr = 'Vừa xong';
                    if (diffDays > 0) timeStr = diffDays + ' ngày trước';
                    else if (diffHours > 0) timeStr = diffHours + ' giờ trước';
                    else if (diff > 60000) timeStr = Math.floor(diff / 60000) + ' phút trước';

                    const userName = profile.full_name || req.username || "Thành viên";
                    const userAvatar = profile.avatar_url || 'https://i.pravatar.cc/150?u=' + req.user_id;

                    return `
                        <article class="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onclick="showExpertConsultationDetail('${req.id}')">
                            <div class="flex items-start gap-4">
                                <img alt="User Avatar" class="w-12 h-12 rounded-full object-cover border-2 border-surface-container-lowest" src="${userAvatar}"/>
                                <div class="flex-1 overflow-hidden">
                                    <div class="flex justify-between items-start mb-1">
                                        <div class="min-w-0">
                                            <h3 class="font-label-lg text-label-lg text-on-background truncate">${userName}</h3>
                                            <span class="font-label-md text-label-md text-on-surface-variant">${timeStr}</span>
                                        </div>
                                        <span class="${isAnswered ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'} font-label-md text-label-md px-2 py-1 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap">
                                            <span class="material-symbols-outlined text-[14px] ${isAnswered ? 'fill' : ''}">${isAnswered ? 'check_circle' : 'pending'}</span> ${isAnswered ? 'Đã trả lời' : 'Chờ tư vấn'}
                                        </span>
                                    </div>
                                    <h4 class="font-headline-md text-headline-md text-on-background mt-2 mb-1 truncate">Yêu cầu nhận diện ${req.ai_prediction || 'cây trồng'}</h4>
                                    <p class="font-body-md text-body-md text-on-surface-variant whitespace-pre-line line-clamp-2 mb-3 break-words">${req.user_note || req.note || 'Không có ghi chú thêm.'}</p>
                                    ${req.image_url ? `<img src="${req.image_url}" onerror="this.style.display='none';" class="w-full h-32 object-cover rounded-lg mb-3" />` : ''}
                                    <div class="flex flex-wrap gap-2 mb-4">
                                        <span class="text-primary font-label-md text-label-md hover:underline cursor-pointer">#${(req.ai_prediction || req.crop_class || 'NôngNghiệp').replace('_', '')}</span>
                                        <span class="text-primary font-label-md text-label-md hover:underline cursor-pointer">#TưVấn</span>
                                    </div>
                                    <div class="flex items-center gap-6 border-t border-outline-variant pt-3 text-on-surface-variant">
                                        <div class="flex items-center gap-1 font-label-md text-label-md cursor-pointer hover:text-primary transition-colors">
                                            <span class="material-symbols-outlined text-[18px]">chat_bubble</span> ${isAnswered ? '1 trả lời' : '0 trả lời'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('');
            }
        } else if (feed) {
            feed.innerHTML = `<div class="p-8 text-center text-on-surface-variant">Chưa có câu hỏi nào.</div>`;
            window.renderQnAPagination(0);
        }
    } catch (err) {
        console.error("Lỗi lấy dữ liệu Expert QnA:", err);
    }
};

// =========================================================
// 🚀 TÍNH NĂNG FEED (BẢNG TIN CỘNG ĐỒNG TỪ SUPABASE)
// =========================================================

window.fetchCommunityFeed = async function () {
    const feedContainer = document.getElementById('dynamic-community-feed');
    const loadingState = document.getElementById('feed-loading-state');
    const emptyState = document.getElementById('feed-empty-state');

    if (!feedContainer || !window.supabaseClient) return;

    if (loadingState) loadingState.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
<<<<<<< HEAD
=======
    feedContainer.querySelectorAll('.agri-post-card').forEach(el => el.remove());
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4

    try {
        let posts, error;
        try {
            // Full join: profiles + likes + comments
            const res = await window.supabaseClient
                .from('posts')
                .select(`
                    *,
                    profiles:user_id(full_name, avatar_url, role),
                    likes(user_id),
                    comments(id)
                `)
                .order('created_at', { ascending: false })
                .limit(20);
            posts = res.data;
            error = res.error;
        } catch (joinErr) {
            // Fallback: just posts without joins
            const res = await window.supabaseClient
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            posts = res.data;
            error = res.error;
        }

        if (error) throw error;
        if (loadingState) loadingState.style.display = 'none';
<<<<<<< HEAD
        
        // Remove existing posts immediately before rendering to prevent race conditions
        feedContainer.querySelectorAll('.agri-post-card').forEach(el => el.remove());

        if (!posts || posts.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            window.postsCache = [];
            return;
        }

        // Cache the posts for other UI interactions
        window.postsCache = posts;

=======

        if (!posts || posts.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
        posts.forEach(post => {
            const postHtml = renderSinglePost(post);
            feedContainer.insertAdjacentHTML('beforeend', postHtml);
        });

        if (typeof currentUser !== 'undefined' && currentUser) {
            updateFeedCreatePostUI(currentUser);
        }

    } catch (err) {
        console.error("Lỗi lấy Bảng tin:", err);
        if (loadingState) loadingState.innerHTML = `<div class="text-red-500 font-bold p-4">❌ Không thể tải bảng tin. Vui lòng thử lại.</div>`;
    }
};

function renderSinglePost(post) {
    const author = post.profiles || {};
    const name = author.full_name || 'Nông dân ẩn danh';
    let avatar = author.avatar_url;
    if (!avatar || avatar === 'NULL' || avatar.trim() === '') {
        avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d631b&color=fff`;
    }

    const dateObj = new Date(post.created_at);
    let timeString = dateObj.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
    const diffHours = Math.round((new Date() - dateObj) / 3600000);
    if (diffHours < 24 && diffHours > 0) timeString = `${diffHours} giờ trước`;
    else if (diffHours === 0) timeString = "Vừa xong";

    const isExpert = author.role === 'expert' || author.role === 'admin';
    const checkmark = isExpert ? `<span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1;">verified</span>` : '';

    // [MỚI]: Xử lý logic đếm Like, Comment
    const likeCount = post.likes ? post.likes.length : 0;
    const commentCount = post.comments ? post.comments.length : 0;

    // Kiểm tra xem User hiện tại đã like bài này chưa
    const isLikedByMe = currentUser && post.likes && post.likes.some(like => like.user_id === currentUser.id);
    const likeIconFill = isLikedByMe ? "'FILL' 1" : "'FILL' 0";
    const likeColorClass = isLikedByMe ? "text-primary" : "text-on-surface-variant";
    const likeBgClass = isLikedByMe ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container-high";

    return `
        <article id="post-${post.id}" class="agri-post-card bg-surface rounded-2xl shadow-[0_4px_12px_rgba(46,125,50,0.08)] border border-outline-variant overflow-hidden">
            <div class="p-5 flex justify-between items-start">
                <div class="flex gap-3">
                    <div class="w-11 h-11 rounded-full ${isExpert ? 'border-2 border-primary' : 'border border-outline-variant'} overflow-hidden relative flex-shrink-0">
                        <img alt="User" class="w-full h-full object-cover" src="${avatar}">
                    </div>
                    <div>
                        <div class="flex items-center gap-1">
                            <h3 class="font-headline-md text-body-lg font-bold text-on-surface">${name}</h3>
                            ${checkmark}
                        </div>
                        <p class="text-label-md text-on-surface-variant">${isExpert ? 'Chuyên gia' : 'Nông dân'} • ${timeString}</p>
                    </div>
                </div>
            </div>

            ${post.caption ? `<div class="px-5 pb-4"><p class="text-body-md text-on-surface whitespace-pre-wrap">${post.caption}</p></div>` : ''}

            ${post.image_url && post.image_url !== 'NULL' ? `
                <div class="w-full max-h-80 overflow-hidden bg-surface-container-highest flex items-center justify-center">
<<<<<<< HEAD
                    <img src="${post.image_url}" class="w-full object-cover cursor-pointer" loading="lazy" onclick="openCommentModal('${post.id}')">
=======
                    <img src="${post.image_url}" class="w-full object-cover" loading="lazy">
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
                </div>
            ` : ''}

            <div class="p-5">
                <div class="flex justify-between items-center mb-4">
<<<<<<< HEAD
                    <div class="flex items-center gap-2 cursor-pointer hover:underline" onclick="if(window.showLikesModal) window.showLikesModal('${post.id}')">
=======
                    <div class="flex items-center gap-2">
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
                        <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <span class="material-symbols-outlined text-[12px] text-white" style="font-variation-settings: 'FILL' 1;">thumb_up</span>
                        </div>
                        <span class="text-[13px] font-bold text-on-surface-variant" id="like-count-${post.id}">${likeCount}</span>
                    </div>
<<<<<<< HEAD
                    <span class="text-[13px] font-bold text-on-surface-variant cursor-pointer hover:underline" id="comment-count-${post.id}" onclick="openCommentModal('${post.id}')">${commentCount} Bình luận</span>
=======
                    <span class="text-[13px] font-bold text-on-surface-variant" id="comment-count-${post.id}">${commentCount} Bình luận</span>
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
                </div>
                
                <div class="flex border-t border-outline-variant pt-4 gap-2">
                    <button onclick="toggleLike(this, '${post.id}')" class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all font-bold text-[14px] ${likeBgClass}">
                        <span class="material-symbols-outlined like-icon ${likeColorClass}" style="font-variation-settings: ${likeIconFill};">thumb_up</span> 
                        <span class="like-text ${likeColorClass}">Hữu ích</span>
                    </button>
                    <button onclick="openCommentModal('${post.id}')" class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-all font-bold text-[14px]">
                        <span class="material-symbols-outlined">mode_comment</span> Bình luận
                    </button>
                    <button onclick="sharePost('${post.id}')" class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-all font-bold text-[14px]">
                        <span class="material-symbols-outlined">share</span> Chia sẻ
                    </button>
                </div>
            </div>
        </article>
    `;
}

// 1. Fix lỗi trùng lặp hàm UI
window.updateFeedCreatePostUI = function (user) {
    if (!user) return;
    const name = user.full_name || user.username || 'bạn';
    let ava = user.avatar_url;
    if (!ava || ava === 'NULL') ava = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d631b&color=fff`;

    const imgEl = document.getElementById('feed-current-user-avatar');
    const nameEl = document.getElementById('feed-current-user-name');
    const plhEl = document.getElementById('feed-current-user-placeholder');

    if (imgEl) { imgEl.src = ava; imgEl.style.display = 'block'; }
    if (plhEl) plhEl.style.display = 'none';
    if (nameEl) nameEl.innerText = name.split(' ').pop();
};

// 2. Khôi phục hàm sharePost (ĐANG BỊ THIẾU)
window.sharePost = function (postId) {
    const modal = document.getElementById('share-modal');
    if (modal) {
        if (currentUser) {
            const shareAva = document.getElementById('share-current-avatar');
            if (shareAva) shareAva.src = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.full_name}&background=0d631b&color=fff`;
        }
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        // Nếu chưa có modal thì copy link nhanh
        const link = window.location.href.split('?')[0] + "?post=" + postId;
        navigator.clipboard.writeText(link).then(() => showToast("Đã sao chép liên kết!", "success"));
    }
};

window.closeShareModal = function () {
    const modal = document.getElementById('share-modal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = 'auto'; }
};

// 3. Đảm bảo toggleLike hoạt động (Dùng window. để fix lỗi not defined)
window.toggleLike = async function (btnElement, postId) {
    if (!currentUser || !currentUser.id) return showToast("Vui lòng đăng nhập!", "warning");

    const icon = btnElement.querySelector('.like-icon');
    const countEl = document.getElementById(`like-count-${postId}`);
    let currentCount = parseInt(countEl.innerText) || 0;
    const isCurrentlyLiked = icon.classList.contains('text-primary');

    try {
        if (!isCurrentlyLiked) {
            // Hiệu ứng UI trước
            icon.style.fontVariationSettings = "'FILL' 1";
            icon.classList.add('text-primary');
            btnElement.classList.add('bg-primary/10', 'text-primary');
            countEl.innerText = currentCount + 1;

            // Gửi dữ liệu - Sử dụng rpc hoặc insert an toàn
            const { error } = await window.supabaseClient
                .from('likes')
                .insert([{ post_id: postId, user_id: currentUser.id }]);

            if (error) throw error;

            // Tạo thông báo cho chủ bài viết
            const likedPost = (window.postsCache || []).find(p => p.id === postId);
            if (likedPost && likedPost.user_id) {
                createNotification(likedPost.user_id, 'like', postId, null, likedPost.image_url || null);
            }
        } else {
            // Hủy Like UI
            icon.style.fontVariationSettings = "'FILL' 0";
            icon.classList.remove('text-primary');
            btnElement.classList.remove('bg-primary/10', 'text-primary');
            countEl.innerText = currentCount > 0 ? currentCount - 1 : 0;

            const { error } = await window.supabaseClient
                .from('likes')
                .delete()
                .match({ post_id: postId, user_id: currentUser.id });

            if (error) throw error;
        }
    } catch (err) {
        console.error("Lỗi thực thi Like:", err);
        // Nếu lỗi xảy ra, tải lại bảng tin để đảm bảo UI đồng bộ với DB
        fetchCommunityFeed();
    }
};

// Cập nhật Avatar ở nút "Bạn đang nghĩ gì..."
function updateFeedCreatePostUI(user) {
    let ava = user.avatar_url;
    const name = user.full_name || 'bạn';
    if (!ava || ava === 'NULL') ava = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00B14F&color=fff`;

    const imgEl = document.getElementById('feed-current-user-avatar');
    const plhEl = document.getElementById('feed-current-user-placeholder');

    if (imgEl && plhEl) {
        imgEl.src = ava;
        imgEl.style.display = 'block';
        plhEl.style.display = 'none';
    }
}

// Kích hoạt nạp Feed khi vào web
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.supabaseClient) fetchCommunityFeed();
    }, 1500); // Chờ Supabase khởi tạo xong mới load
});

/// ================================================================ //
// =================== SHARE TO COMMUNITY MODAL =================== //
// ================================================================ //

// State for the share modal
let scTaggedUsers = [];
let scLocation = '';
let scTagSearchTimeout = null;

window.openShareToCommunityModal = function () {
    const modal = document.getElementById('share-community-modal');
    if (!modal) return;

    // Reset state
    scTaggedUsers = [];
    scLocation = '';

    // Populate user info
    if (currentUser) {
        const avaEl = document.getElementById('sc-user-avatar');
        const nameEl = document.getElementById('sc-user-name');
        if (avaEl) avaEl.src = currentUser.avatar_url || currentUser.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name || 'U')}&background=0d631b&color=fff`;
        if (nameEl) nameEl.innerText = currentUser.full_name || currentUser.profile?.full_name || 'Người dùng';
    }

    // Populate scan result data from currentResult
    if (currentResult) {
        const details = currentResult.details || {};
        const cropImg = document.getElementById('sc-crop-img');
        const cropName = document.getElementById('sc-crop-name');
        const cropDesc = document.getElementById('sc-crop-desc');

        if (cropImg) cropImg.src = currentResult.image_url || '';
        if (cropName) cropName.innerText = details.vi || currentResult.prediction || 'Cây trồng';
        if (cropDesc) {
            const probPct = ((currentResult.probability || 0) * 100).toFixed(1);
            cropDesc.innerText = details.mo_ta || `Kết quả nhận diện: ${currentResult.prediction}. Độ tin cậy: ${probPct}%`;
        }
    }

    // Reset UI elements
    const captionInput = document.getElementById('sc-caption-input');
    if (captionInput) captionInput.value = '';

    const tagSearch = document.getElementById('sc-tag-search');
    if (tagSearch) tagSearch.value = '';

    const locInput = document.getElementById('sc-location-input');
    if (locInput) locInput.value = '';

    // Hide panels
    hideEl('sc-tag-panel');
    hideEl('sc-location-panel');
    hideEl('sc-tagged-users-display');
    hideEl('sc-location-display');

    // Reset tag results
    const tagResults = document.getElementById('sc-tag-results');
    if (tagResults) {
        tagResults.innerHTML = `<div class="p-4 text-center text-on-surface-variant font-body-md">
            <span class="material-symbols-outlined text-outline-variant text-3xl mb-2 block">group_add</span>
            Nhập tên để tìm kiếm
        </div>`;
    }

    // Reset button states
    resetToggleBtn('btn-toggle-tag');
    resetToggleBtn('btn-toggle-location');

    // Reset AI toggle (default: ON)
    const aiToggle = document.getElementById('sc-ai-toggle');
    if (aiToggle) aiToggle.checked = true;
    const aiCard = document.getElementById('sc-ai-card');
    if (aiCard) { aiCard.classList.remove('hidden'); aiCard.style.maxHeight = ''; aiCard.style.opacity = ''; }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

// Toggle hiển thị card kết quả AI trong modal đăng bài
window.toggleAiResultCard = function () {
    const toggle = document.getElementById('sc-ai-toggle');
    const card = document.getElementById('sc-ai-card');
    if (!card) return;

    if (toggle && toggle.checked) {
        card.classList.remove('hidden');
        card.style.opacity = '1';
        card.style.maxHeight = '200px';
    } else {
        card.style.opacity = '0';
        card.style.maxHeight = '0';
        card.style.padding = '0';
        card.style.marginBottom = '0';
        card.style.border = 'none';
        setTimeout(() => card.classList.add('hidden'), 200);
    }
};

function hideEl(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}
function showEl(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}
function resetToggleBtn(id) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.classList.remove('bg-primary/10', 'border-primary', 'text-primary');
    }
}

window.closeShareCommunityModal = function () {
    const modal = document.getElementById('share-community-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

// ---- TOGGLE PANELS ----

window.toggleTagExpertsPanel = function () {
    const panel = document.getElementById('sc-tag-panel');
    const btn = document.getElementById('btn-toggle-tag');
    if (!panel) return;
    const isVisible = !panel.classList.contains('hidden');
    if (isVisible) {
        panel.classList.add('hidden');
        if (btn) btn.classList.remove('bg-primary/10', 'border-primary', 'text-primary');
    } else {
        panel.classList.remove('hidden');
        if (btn) btn.classList.add('bg-primary/10', 'border-primary', 'text-primary');
        // Hide location panel
        hideEl('sc-location-panel');
        resetToggleBtn('btn-toggle-location');
        // Focus search
        setTimeout(() => document.getElementById('sc-tag-search')?.focus(), 100);
    }
};

window.toggleLocationPanel = function () {
    const panel = document.getElementById('sc-location-panel');
    const btn = document.getElementById('btn-toggle-location');
    if (!panel) return;
    const isVisible = !panel.classList.contains('hidden');
    if (isVisible) {
        panel.classList.add('hidden');
        if (btn) btn.classList.remove('bg-primary/10', 'border-primary', 'text-primary');
    } else {
        panel.classList.remove('hidden');
        if (btn) btn.classList.add('bg-primary/10', 'border-primary', 'text-primary');
        // Hide tag panel
        hideEl('sc-tag-panel');
        resetToggleBtn('btn-toggle-tag');
        // Focus input
        setTimeout(() => document.getElementById('sc-location-input')?.focus(), 100);
    }
};

// ---- TAG EXPERTS ----

window.searchUsersToTag = function (query) {
    clearTimeout(scTagSearchTimeout);
    const resultsEl = document.getElementById('sc-tag-results');
    if (!resultsEl) return;

    query = (query || '').trim();
    if (query.length < 2) {
        resultsEl.innerHTML = `<div class="p-4 text-center text-on-surface-variant font-body-md">
            <span class="material-symbols-outlined text-outline-variant text-3xl mb-2 block">group_add</span>
            Nhập ít nhất 2 ký tự để tìm kiếm
        </div>`;
        return;
    }

    resultsEl.innerHTML = `<div class="p-4 text-center text-on-surface-variant font-body-md">
        <div class="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1"></div>
        <div>Đang tìm...</div>
    </div>`;

    scTagSearchTimeout = setTimeout(async () => {
        try {
            let users = [];
            if (window.supabaseClient) {
                let q = window.supabaseClient
                    .from('profiles')
                    .select('id, full_name, username, avatar_url, role')
                    .ilike('full_name', `%${query}%`)
                    .limit(8);
                // Only exclude self if we have a valid user ID
                if (currentUser && currentUser.id) {
                    q = q.neq('id', currentUser.id);
                }
                const { data, error } = await q;
                if (!error && data) users = data;
            }

            // Fallback via API
            if (users.length === 0) {
                try {
                    const res = await fetch(`/api/explore/search?q=${encodeURIComponent(query)}`);
                    const results = await res.json();
                    users = results
                        .filter(r => r.type === 'user')
                        .map(r => ({ id: r.id, full_name: r.title, avatar_url: r.image_url, role: r.subtitle }));
                } catch (e) { }
            }

            if (users.length === 0) {
                resultsEl.innerHTML = `<div class="p-4 text-center text-on-surface-variant font-body-md">
                    <span class="material-symbols-outlined text-outline-variant text-2xl mb-1 block">person_off</span>
                    Không tìm thấy "${query}"
                </div>`;
                return;
            }

            // Filter out already-tagged
            const taggedIds = scTaggedUsers.map(u => u.id);

            resultsEl.innerHTML = users.map(u => {
                const isTagged = taggedIds.includes(u.id);
                const avatar = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name || 'U')}&background=0d631b&color=fff&size=80`;
                const roleBadge = (u.role === 'expert' || u.role === 'admin')
                    ? `<span class="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">Chuyên gia</span>`
                    : '';
                return `
                <div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors cursor-pointer ${isTagged ? 'opacity-50' : ''}"
                     onclick="${isTagged ? '' : "tagUser('" + u.id + "', '" + (u.full_name || '').replace(/'/g, "\\'") + "', '" + (avatar).replace(/'/g, "\\'") + "')"}" >
                    <img src="${avatar}" class="w-9 h-9 rounded-full object-cover border border-outline-variant" alt="" />
                    <div class="flex-1 min-w-0">
                        <div class="font-label-lg text-label-lg text-on-surface truncate">${u.full_name || 'Người dùng'}${roleBadge}</div>
                        <div class="font-body-md text-body-md text-on-surface-variant text-xs truncate">@${u.username || u.id?.substring(0, 8)}</div>
                    </div>
                    ${isTagged
                        ? '<span class="material-symbols-outlined text-primary text-[20px]">check_circle</span>'
                        : '<span class="material-symbols-outlined text-outline text-[20px]">add_circle_outline</span>'
                    }
                </div>`;
            }).join('');

        } catch (err) {
            resultsEl.innerHTML = `<div class="p-4 text-center text-error font-body-md">Lỗi tìm kiếm</div>`;
        }
    }, 350);
};

window.tagUser = function (id, name, avatar) {
    if (scTaggedUsers.find(u => u.id === id)) return;
    scTaggedUsers.push({ id, name, avatar });
    renderTaggedChips();
    // Re-render search results to show checkmark
    const searchInput = document.getElementById('sc-tag-search');
    if (searchInput && searchInput.value.trim()) {
        searchUsersToTag(searchInput.value);
    }
    showToast(`Đã tag ${name}`, 'success');
};

window.untagUser = function (id) {
    scTaggedUsers = scTaggedUsers.filter(u => u.id !== id);
    renderTaggedChips();
    // Re-render search results
    const searchInput = document.getElementById('sc-tag-search');
    if (searchInput && searchInput.value.trim()) {
        searchUsersToTag(searchInput.value);
    }
};

function renderTaggedChips() {
    const container = document.getElementById('sc-tagged-users-display');
    if (!container) return;
    if (scTaggedUsers.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    container.innerHTML = scTaggedUsers.map(u => `
        <div class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 bg-secondary-container/60 text-on-secondary-container rounded-full font-label-md text-label-md border border-secondary/20">
            <img src="${u.avatar}" class="w-5 h-5 rounded-full object-cover" alt="" />
            <span>${u.name}</span>
            <button onclick="untagUser('${u.id}')" class="ml-0.5 hover:text-error transition-colors">
                <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
        </div>
    `).join('');
}

// ---- LOCATION ----

window.applyManualLocation = function () {
    const input = document.getElementById('sc-location-input');
    const val = input ? input.value.trim() : '';
    if (!val) {
        showToast('Vui lòng nhập vị trí!', 'info');
        return;
    }
    setShareLocation(val);
};

window.setQuickLocation = function (loc) {
    setShareLocation(loc);
    const input = document.getElementById('sc-location-input');
    if (input) input.value = loc;
};

function setShareLocation(loc) {
    scLocation = loc;
    const display = document.getElementById('sc-location-display');
    const text = document.getElementById('sc-location-text');
    if (display) display.classList.remove('hidden');
    if (text) text.innerText = loc;
    // Hide panel after selection
    hideEl('sc-location-panel');
    resetToggleBtn('btn-toggle-location');
    showToast(`📍 Đã thêm vị trí: ${loc}`, 'success');
}

window.removeShareLocation = function () {
    scLocation = '';
    hideEl('sc-location-display');
    const input = document.getElementById('sc-location-input');
    if (input) input.value = '';
};

window.detectGPSLocation = function () {
    if (!navigator.geolocation) {
        showToast('Trình duyệt không hỗ trợ GPS.', 'error');
        return;
    }
    showToast('Đang xác định vị trí...', 'info');
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                // Reverse geocode via OpenStreetMap Nominatim (free, no API key)
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=vi`);
                const geo = await res.json();
                const addr = geo.address || {};
                const locationStr = [addr.city || addr.town || addr.village || addr.county, addr.state || addr.province].filter(Boolean).join(', ') || geo.display_name?.split(',').slice(0, 3).join(',') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                const input = document.getElementById('sc-location-input');
                if (input) input.value = locationStr;
                setShareLocation(locationStr);
            } catch (e) {
                const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                const input = document.getElementById('sc-location-input');
                if (input) input.value = fallback;
                setShareLocation(fallback);
            }
        },
        (err) => {
            showToast('Không thể lấy vị trí GPS. Hãy nhập thủ công.', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

// ---- SUBMIT POST ----

window.submitShareToCommunity = async function () {
    if (!currentUser || !currentResult) {
        showToast('Không có dữ liệu kết quả để chia sẻ.', 'error');
        return;
    }

    const captionInput = document.getElementById('sc-caption-input');
    const userCaption = captionInput ? captionInput.value.trim() : '';
    const details = currentResult.details || {};
    const cropName = details.vi || currentResult.prediction || 'Cây trồng';
    const probPct = ((currentResult.probability || 0) * 100).toFixed(1);

    // Build the caption
    let finalCaption = '';
    if (userCaption) {
        finalCaption = userCaption;
    }

    // Chỉ đính kèm thông tin AI nếu toggle bật
    const aiToggle = document.getElementById('sc-ai-toggle');
    const includeAI = aiToggle ? aiToggle.checked : true;
    if (includeAI) {
        if (finalCaption) finalCaption += '\n\n';
        finalCaption += `🌿 AI Nhận diện: ${cropName}`;
        if (details.mo_ta) {
            finalCaption += `\n📝 ${details.mo_ta.substring(0, 150)}`;
        }
    }

    // Append tagged users
    if (scTaggedUsers.length > 0) {
        const tagNames = scTaggedUsers.map(u => `@${u.name}`).join(' ');
        finalCaption += `\n\n👥 Tag: ${tagNames}`;
    }

    // Append location
    if (scLocation) {
        finalCaption += `\n📍 ${scLocation}`;
    }

    const btn = document.getElementById('btn-submit-share-community');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Đang đăng...';
    }

    try {
        const imageUrl = currentResult.image_url || '';

        if (window.supabaseClient) {
            // Build post object with only columns that exist in the posts table
            const newPost = {
                user_id: currentUser.id,
                caption: finalCaption,
                image_url: imageUrl,
                crop_name: cropName
            };

            let insertError = null;
            // Try insert
            const { data, error } = await window.supabaseClient.from('posts').insert([newPost]);
            if (error) {
                // If crop_name column doesn't exist, try without it
                const fallbackPost = { user_id: currentUser.id, caption: finalCaption, image_url: imageUrl };
                const res2 = await window.supabaseClient.from('posts').insert([fallbackPost]);
                if (res2.error) throw res2.error;
            }

            // Send notifications to tagged users (silent)
            for (const taggedUser of scTaggedUsers) {
                try {
                    await window.supabaseClient.from('notifications').insert([{
                        user_id: taggedUser.id,
                        actor_id: currentUser.id,
                        type: 'mention',
                        comment_text: `đã nhắc đến bạn trong một bài đăng về ${cropName}`
                    }]);
                } catch (e) { /* silent fail for notifications */ }
            }
        } else {
            const formData = new FormData();
            formData.append('user_id', currentUser.id);
            formData.append('caption', finalCaption);
            formData.append('crop_name', cropName);
            formData.append('image_url', imageUrl);

            const res = await fetch('/api/community/post', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.error || 'Lỗi đăng bài');
        }

        closeShareCommunityModal();
        showToast('🎉 Đã chia sẻ kết quả lên cộng đồng thành công!', 'success');
        if (typeof switchTab === 'function') switchTab('page-community');
        if (typeof fetchCommunityFeed === 'function') fetchCommunityFeed();

    } catch (e) {
        showToast('Lỗi đăng bài: ' + (e.message || e), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Đăng bài';
        }
    }
};

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('share-community-modal');
    if (modal && e.target === modal) {
        closeShareCommunityModal();
    }
});

/// ================================================================ //
// =================== POST CREATION MODAL ======================== //
// ================================================================ //

window.openPostModal = function () {
    const modal = document.getElementById('post-modal');
    if (!modal) return;

    // Reset lại nội dung
    const captionInput = document.getElementById('post-caption-input');
    if (captionInput) captionInput.value = '';

    removePostImage(); // Xóa ảnh cũ nếu có

    // Gắn thông tin User hiện tại vào Hộp thoại
    if (currentUser) {
        const avaEl = document.getElementById('pm-user-avatar');
        const nameEl = document.getElementById('pm-user-name');
        if (avaEl) avaEl.src = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.full_name}&background=0d631b&color=fff`;
        if (nameEl) nameEl.innerText = currentUser.full_name || 'Người dùng';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Chống cuộn nền
};

window.closePostModal = function () {
    const modal = document.getElementById('post-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

window.handlePostImageSelect = async function (input) {
    const file = input.files[0];
    if (!file) return;

    const previewContainer = document.getElementById('pm-img-preview-container');
    const previewImg = document.getElementById('pm-preview-img');

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
};

window.removePostImage = function () {
    const previewContainer = document.getElementById('pm-img-preview-container');
    const previewImg = document.getElementById('pm-preview-img');
    const fileInput = document.getElementById('pm-file-upload');

    if (previewContainer) previewContainer.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (fileInput) fileInput.value = '';
}

// Hàm gửi bài (Phiên bản kết nối trực tiếp Supabase)
window.submitPost = async function () {
    const caption = document.getElementById('post-caption-input').value.trim();
    const fileInput = document.getElementById('pm-file-upload');
    const file = fileInput.files[0];

    if (!caption && !file) return showToast("Hãy viết gì đó hoặc chọn một bức ảnh nhé!", "warning");

    const btn = document.getElementById('btn-submit-post');
    btn.disabled = true;
    btn.innerText = "Đang đăng...";

    try {
        let imageUrl = null;

        // Nếu có upload ảnh, đẩy lên Storage của Supabase thay vì dùng Base64
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
            const filePath = `posts/${fileName}`;

            // 1. Upload lên bucket 'crop-images'
            const { data: uploadData, error: uploadError } = await window.supabaseClient
                .storage
                .from('crop-images')
                .upload(filePath, file);

            if (uploadError) {
                console.warn("Lỗi tải lên Storage (có thể do chưa cấu hình RLS), chuyển sang dùng Base64:", uploadError);
                // Dùng Base64 làm ảnh trực tiếp thay vì thông qua Storage (bỏ qua giới hạn 500KB)
                imageUrl = document.getElementById('pm-preview-img').src;
            } else {
                // 2. Lấy URL công khai
                const { data: { publicUrl } } = window.supabaseClient
                    .storage
                    .from('crop-images')
                    .getPublicUrl(filePath);
                imageUrl = publicUrl;
            }
        }

        const newPost = {
            user_id: currentUser.id,
            caption: caption,
            image_url: imageUrl,
            crop_name: 'Nông nghiệp' // Có thể mở rộng để chọn cây trồng sau
        };

        const { data, error } = await window.supabaseClient.from('posts').insert([newPost]);
        if (error) throw error;

        closePostModal();
        showToast("Đăng bài thành công!", "success");

        // Reload feed
        if (typeof fetchCommunityFeed === 'function') fetchCommunityFeed();

    } catch (e) {
        showToast("Lỗi đăng bài: " + e.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Đăng bài";
    }
};

// ================================================================ //
// =================== PREMIUM COMMENTS =========================== //
// ================================================================ //

<<<<<<< HEAD
window.openLightbox = function(src) {
    const lb = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    if (!lb || !img) return;
    img.src = src;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.timeAgo = function(dateStr) {
    if (!dateStr) return 'Vừa xong';
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + ' phút trước';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' giờ trước';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + ' ngày trước';
    const months = Math.floor(days / 30);
    if (months < 12) return months + ' tháng trước';
    return Math.floor(months / 12) + ' năm trước';
};

window.showLikesModal = async function(postId) {
    if (!window.supabaseClient) return;
    
    // Tạo modal nếu chưa có
    let modal = document.getElementById('likes-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="likes-modal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm hidden items-center justify-center p-4">
                <div class="bg-surface w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-fade-in-up">
                    <div class="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                        <h3 class="font-headline-md text-title-lg text-on-surface">Người đã thích</h3>
                        <button onclick="document.getElementById('likes-modal').style.display='none'; document.body.style.overflow=''" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors">
                            <span class="material-symbols-outlined text-on-surface-variant">close</span>
                        </button>
                    </div>
                    <div id="likes-modal-list" class="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
                        <!-- Danh sách render ở đây -->
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('likes-modal');
        
        // Đóng modal khi click ra ngoài
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }

    const list = document.getElementById('likes-modal-list');
    list.innerHTML = `<div class="text-center py-4"><span class="material-symbols-outlined animate-spin text-primary">sync</span></div>`;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
        const { data, error } = await window.supabaseClient
            .from('likes')
            .select('profiles(full_name, avatar_url)')
            .eq('post_id', postId);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center py-4 text-on-surface-variant">Chưa có lượt thích nào.</div>`;
            return;
        }

        list.innerHTML = data.map(item => {
            const p = item.profiles || {};
            const name = p.full_name || 'Nông dân';
            const ava = p.avatar_url && p.avatar_url !== 'NULL' ? p.avatar_url : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d631b&color=fff`;
            return `
                <div class="flex items-center gap-3">
                    <img src="${ava}" class="w-10 h-10 rounded-full object-cover border border-outline-variant/30">
                    <span class="font-bold text-on-surface text-[15px]">${name}</span>
                </div>
            `;
        }).join('');
    } catch(err) {
        console.error("Lỗi lấy danh sách like:", err);
        list.innerHTML = `<div class="text-center py-4 text-red-500">Lỗi khi tải dữ liệu</div>`;
    }
};

=======
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
window.openCommentModal = async function (postId) {
    const safePostId = String(postId);
    const modal = document.getElementById('comment-modal');
    const hiddenInput = document.getElementById('cmt-modal-target-id');
<<<<<<< HEAD
    const title = document.getElementById('cmt-modal-title');
    const postContentContainer = document.getElementById('cmt-modal-post-content');
=======
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4

    if (!modal || !hiddenInput) return;
    hiddenInput.value = safePostId;
    window.STRICT_POST_ID_LOCK = safePostId;

<<<<<<< HEAD
    // Tìm bài viết để render vào phần trên của modal
    if (window.postsCache) {
        const post = window.postsCache.find(p => p.id === safePostId);
        if (post && postContentContainer) {
            const author = post.profiles || {};
            const name = author.full_name || 'Nông dân ẩn danh';
            let avatar = author.avatar_url;
            if (!avatar || avatar === 'NULL' || avatar.trim() === '') {
                avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d631b&color=fff`;
            }
            const timeString = window.timeAgo ? window.timeAgo(post.created_at) : 'Vừa xong';
            const likeCount = post.likes ? post.likes.length : 0;
            const commentCount = post.comments ? post.comments.length : 0;
            
            if (title) title.innerText = `Bài viết của ${name}`;
            
            postContentContainer.innerHTML = `
                <div class="px-4 pt-4 pb-2 flex justify-between items-start">
                    <div class="flex gap-3">
                        <img class="w-10 h-10 rounded-full object-cover border border-outline-variant/30" src="${avatar}">
                        <div>
                            <h3 class="font-bold text-[15px] text-on-surface leading-tight">${name}</h3>
                            <p class="text-[13px] text-on-surface-variant">${timeString} • <span class="material-symbols-outlined text-[13px] align-middle">public</span></p>
                        </div>
                    </div>
                </div>
                ${post.caption ? `<div class="px-4 pb-3"><p class="text-[15px] text-on-surface whitespace-pre-wrap leading-relaxed">${post.caption}</p></div>` : ''}
                ${post.image_url && post.image_url !== 'NULL' ? `
                    <div class="w-full max-h-[400px] overflow-hidden bg-black flex items-center justify-center">
                        <img src="${post.image_url}" class="w-full max-h-[400px] object-contain cursor-zoom-in" onclick="openLightbox('${post.image_url}')">
                    </div>
                ` : ''}
                <div class="px-4 py-3 flex justify-between items-center">
                    <div class="flex items-center gap-1.5 cursor-pointer hover:underline" onclick="if(window.showLikesModal) window.showLikesModal('${post.id}')">
                        <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <span class="material-symbols-outlined text-[11px] text-white" style="font-variation-settings: 'FILL' 1;">thumb_up</span>
                        </div>
                        <span class="text-[14px] text-on-surface-variant hover:text-on-surface">${likeCount}</span>
                    </div>
                    <div class="flex gap-3 text-[14px] text-on-surface-variant">
                        <span>${commentCount} bình luận</span>
                    </div>
                </div>
                <div class="px-4 pb-2">
                    <div class="flex border-y border-outline-variant/50 py-1 gap-1">
                        <button onclick="toggleLike(this, '${post.id}')" class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant font-bold text-[14px]">
                            <span class="material-symbols-outlined">thumb_up</span> Thích
                        </button>
                        <button class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant font-bold text-[14px]">
                            <span class="material-symbols-outlined">chat_bubble_outline</span> Bình luận
                        </button>
                        <button onclick="sharePost('${post.id}')" class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant font-bold text-[14px]">
                            <span class="material-symbols-outlined">share</span> Chia sẻ
                        </button>
                    </div>
                </div>
            `;
        }
    }

=======
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderModalComments(safePostId);
};

window.closeCommentModal = function (e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById('comment-modal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = 'auto'; }
};

async function renderModalComments(postId) {
    const list = document.getElementById('cmt-modal-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8;">🔄 Đang tải...</div>';

    try {
        const res = await fetch(`/api/community/comments/${postId}`);
        const comments = await res.json();

        if (!Array.isArray(comments) || comments.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;">Chưa có bình luận nào</div>`;
            return;
        }

        list.innerHTML = comments.map(c => {
            const displayName = c.profiles?.full_name || 'Nhà nông';
<<<<<<< HEAD
            const timeString = window.timeAgo ? window.timeAgo(c.created_at) : 'Vừa xong';
            return `
                <div class="cmt-item mb-4 flex gap-2">
                    <div class="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xs shrink-0">${displayName.charAt(0)}</div>
                    <div class="flex-1">
                        <div class="bg-gray-100 p-3 rounded-xl shadow-sm text-sm inline-block min-w-[50%]">
                            <div class="font-bold mb-1">${displayName}</div>
                            <div>${c.content}</div>
                        </div>
                        <div class="flex items-center gap-4 mt-1 ml-2 text-[12px] text-slate-500 font-medium">
                            <span>${timeString}</span>
                            <button onclick="this.classList.toggle('text-primary'); this.classList.toggle('font-bold');" class="hover:text-primary transition-colors">Thích</button>
                            <button onclick="const input = document.getElementById('cmt-input-field'); input.value = '@${displayName} ' + input.value; input.focus();" class="hover:text-primary transition-colors">Trả lời</button>
                        </div>
=======
            return `
                <div class="cmt-item mb-4 flex gap-2">
                    <div class="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xs">${displayName.charAt(0)}</div>
                    <div class="bg-gray-100 p-3 rounded-xl shadow-sm text-sm w-full">
                        <div class="font-bold mb-1">${displayName}</div>
                        <div>${c.content}</div>
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Lỗi tải bình luận.</div>';
    }
}

window.submitModalComment = async function () {
    const input = document.getElementById('cmt-input-field');
    const hiddenInput = document.getElementById('cmt-modal-target-id');
    let postId = hiddenInput ? hiddenInput.value : window.STRICT_POST_ID_LOCK;

    if (!input || !input.value.trim() || !postId) return;
    const content = input.value.trim();
    input.value = ''; input.disabled = true;

    try {
        const formData = new FormData();
        formData.append("post_id", postId);
        formData.append("user_id", currentUser ? currentUser.id : "00000000-0000-0000-0000-000000000000");
        formData.append("content", content);

        const res = await fetch('/api/community/comment', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            showToast("Đã gửi bình luận!", "success");
<<<<<<< HEAD
            
            // Cập nhật số đếm ở bài viết bên ngoài
            const countEl = document.getElementById(`comment-count-${postId}`);
            if (countEl) {
                const curCount = parseInt(countEl.innerText) || 0;
                countEl.innerText = `${curCount + 1} Bình luận`;
            }

            // Lấy HTML list và thêm comment mới ngay lập tức
            const list = document.getElementById('cmt-modal-list');
            if (list) {
                if (list.innerHTML.includes('Chưa có bình luận nào') || list.innerHTML.includes('Đang tải')) {
                    list.innerHTML = '';
                }
                const displayName = currentUser?.full_name || 'Bạn';
                const timeString = 'Vừa xong';
                list.insertAdjacentHTML('beforeend', `
                    <div class="cmt-item mb-4 flex gap-2 animate-fade-in-up">
                        <div class="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs shrink-0">${displayName.charAt(0)}</div>
                        <div class="flex-1">
                            <div class="bg-primary/10 p-3 rounded-xl shadow-sm text-sm inline-block min-w-[50%]">
                                <div class="font-bold mb-1 text-primary">${displayName}</div>
                                <div>${content}</div>
                            </div>
                            <div class="flex items-center gap-4 mt-1 ml-2 text-[12px] text-slate-500 font-medium">
                                <span>${timeString}</span>
                                <button onclick="this.classList.toggle('text-primary'); this.classList.toggle('font-bold');" class="hover:text-primary transition-colors">Thích</button>
                                <button onclick="const input = document.getElementById('cmt-input-field'); input.value = '@${displayName} ' + input.value; input.focus();" class="hover:text-primary transition-colors">Trả lời</button>
                            </div>
                        </div>
                    </div>
                `);
                list.scrollTop = list.scrollHeight;
            }

=======
            renderModalComments(postId);
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
            // Tạo thông báo cho chủ bài viết
            const commentedPost = (window.postsCache || []).find(p => p.id === postId);
            if (commentedPost && commentedPost.user_id) {
                createNotification(commentedPost.user_id, 'comment', postId, content.substring(0, 80), commentedPost.image_url || null);
            }
        }
    } catch (e) {
        showToast("Lỗi gửi bình luận", "error");
    } finally {
        input.disabled = false; input.focus();
    }
};

// ================================================================ //
// =================== PROFILE LOGIC ============================== //
// ================================================================ //

window.viewUserProfile = function (userId, tab = 'posts') {
    let targetId = userId;
    if (!targetId && typeof currentUser !== 'undefined' && currentUser) {
        targetId = currentUser.id;
    }
    if (!targetId) {
        showToast("Vui lòng đăng nhập!", "warning");
        return;
    }
    window.targetProfileId = targetId;
    window.bypassProfileReset = true;
    window.initialProfileTab = tab;
    switchTab('page-profile');
};

async function renderProfilePage() {
    const profileContainer = document.getElementById('page-profile');
    if (!profileContainer) return;
    const uid = window.targetProfileId || (currentUser ? currentUser.id : null);
    if (!uid) { profileContainer.innerHTML = '<div style="text-align:center; padding:50px;">Vui lòng đăng nhập</div>'; return; }

    try {
        const { data: profile } = await window.supabaseClient.from('profiles').select('*').eq('id', uid).single();
        const p = profile || {};
        const isSelf = (currentUser && currentUser.id === uid);

        // Count stats
        let postCount = 0, followerCount = 0, followingCount = 0;
        try {
            const { count: pc } = await window.supabaseClient.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', uid);
            postCount = pc || 0;
        } catch (e) { }
        try {
            const { count: fc } = await window.supabaseClient.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', uid);
            followerCount = fc || 0;
        } catch (e) { }
        try {
            const { count: fgc } = await window.supabaseClient.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', uid);
            followingCount = fgc || 0;
        } catch (e) { }

        // Format join date
        let joinedStr = 'Thành viên';
        if (p.created_at) {
            const d = new Date(p.created_at);
            joinedStr = 'Tham gia ' + d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
        }

        const userData = {
            id: uid, isSelf: isSelf,
            full_name: p.full_name || (isSelf ? currentUser.username : "Người dùng"),
            username: p.username || "user_" + uid.substring(0, 5),
            bio: p.bio || "Nông dân đam mê công nghệ 🌾",
            avatar_url: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'U')}&background=0d631b&color=fff`,
            cover_url: p.cover_url || "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
            role: p.role || 'member',
            location: p.farm_location || p.location || '',
            joined: joinedStr,
            crops: p.main_crop ? [p.main_crop] : ['Lúa gạo', 'Ngô'],
            stats: { posts: postCount, followers: followerCount, following: followingCount }
        };

        // Build 2-column layout
        profileContainer.innerHTML = `
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1 flex flex-col gap-4">
                    ${AgrisocialComponents.renderProfileHeader(userData)}
                    <div id="profile-content-list" class="min-h-[200px]"></div>
                </div>
                <div class="w-full md:w-[320px] shrink-0 flex flex-col gap-4">
                    ${AgrisocialComponents.renderProfileSidebar(userData)}
                </div>
            </div>
        `;
        const startTab = window.initialProfileTab || 'posts';
        window.initialProfileTab = null;
        switchProfileTab(startTab);
    } catch (err) { console.error(err); }
}

window.switchProfileTab = async function (tabId) {
    const listContainer = document.getElementById('profile-content-list');
    if (!listContainer) return;

    // Update tab styling
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.classList.remove('text-primary', 'border-b-2', 'border-primary');
        btn.classList.add('text-on-surface-variant');
    });
    const activeBtn = document.getElementById(`tab-btn-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-on-surface-variant');
        activeBtn.classList.add('text-primary', 'border-b-2', 'border-primary');
    }

    listContainer.innerHTML = '<div class="p-8 text-center text-on-surface-variant"><div class="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div><div class="font-body-md text-body-md">Đang tải...</div></div>';

    const uid = window.targetProfileId || (currentUser ? currentUser.id : null);
    if (!uid) return;

    if (tabId === 'posts') {
        try {
            const { data: posts, error } = await window.supabaseClient
                .from('posts')
                .select('*')
                .eq('user_id', uid)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error || !posts || posts.length === 0) {
                listContainer.innerHTML = `
                    <div class="bg-surface rounded-xl p-8 text-center border border-outline-variant/30 shadow-[0_2px_10px_rgba(46,125,50,0.04)]">
                        <span class="material-symbols-outlined text-outline text-5xl mb-3 block">article</span>
                        <p class="font-label-lg text-label-lg text-on-surface-variant">Chưa có bài viết nào</p>
                    </div>`;
                return;
            }

            listContainer.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${posts.map(post => {
                const dateObj = new Date(post.created_at);
                let timeStr = dateObj.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
                const diffHours = Math.round((new Date() - dateObj) / 3600000);
                if (diffHours < 24 && diffHours > 0) timeStr = diffHours + ' giờ trước';
                else if (diffHours === 0) timeStr = 'Vừa xong';

                return `
                <div class="bg-surface rounded-xl p-5 shadow-[0_2px_10px_rgba(46,125,50,0.04)] border border-outline-variant/30 flex flex-col gap-3">
                    <div class="flex items-center gap-3">
                        <img src="${post.profiles?.avatar_url || document.getElementById('tab-btn-posts')?.closest('.tab-page')?.querySelector('img')?.src || 'https://ui-avatars.com/api/?name=U&background=0d631b&color=fff'}" class="w-10 h-10 rounded-full object-cover" alt="" />
                        <div>
                            <p class="font-label-lg text-label-lg text-on-surface">${post.profiles?.full_name || currentUser?.full_name || 'Người dùng'}</p>
                            <p class="font-body-md text-body-md text-on-surface-variant text-[12px]">${timeStr}</p>
                        </div>
                    </div>
                    <p class="font-body-md text-body-md text-on-surface">${(post.caption || '').replace(/\n/g, '<br>')}</p>
                    ${post.image_url ? `<img src="${post.image_url}" class="rounded-lg w-full h-48 object-cover" onerror="this.style.display='none'" alt="" />` : ''}
                    <div class="flex justify-between mt-auto pt-3 border-t border-outline-variant/20">
                        <button onclick="toggleLike('${post.id}')" class="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md">
                            <span class="material-symbols-outlined text-[20px]">thumb_up</span> ${post.likes_count || 0}
                        </button>
                        <button onclick="openCommentModal('${post.id}')" class="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md">
                            <span class="material-symbols-outlined text-[20px]">chat_bubble_outline</span> ${post.comments_count || 0}
                        </button>
                        <button onclick="sharePost('${post.id}')" class="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md">
                            <span class="material-symbols-outlined text-[20px]">share</span> Chia sẻ
                        </button>
                    </div>
                </div>`;
            }).join('')}</div>`;
        } catch (err) {
            listContainer.innerHTML = '<div class="p-4 text-center text-error">Lỗi tải bài viết</div>';
        }
    } else if (tabId === 'followers' || tabId === 'following') {
        const column = tabId === 'followers' ? 'following_id' : 'follower_id';
        const targetColumn = tabId === 'followers' ? 'follower_id' : 'following_id';

        try {
            // BƯỚC 1: Lấy danh sách ID từ bảng follows (Tránh join phức tạp gây lỗi PGRST200)
            const { data: followData, error: followError } = await window.supabaseClient
                .from('follows')
                .select(targetColumn)
                .eq(column, uid);

            if (followError) throw followError;

            if (!followData || followData.length === 0) {
                listContainer.innerHTML = `
                    <div class="bg-surface rounded-xl p-8 text-center border border-outline-variant/30 shadow-[0_2px_10px_rgba(46,125,50,0.04)]">
                        <span class="material-symbols-outlined text-outline text-5xl mb-3 block">group</span>
                        <p class="font-label-lg text-label-lg text-on-surface-variant">Chưa có ai ở đây</p>
                    </div>`;
                return;
            }

            const profileIds = followData.map(d => d[targetColumn]);

            // BƯỚC 2: Lấy thông tin chi tiết profile cho các ID này
            const { data: profiles, error: profileError } = await window.supabaseClient
                .from('profiles')
                .select('id, full_name, avatar_url, bio, farm_location, main_crop')
                .in('id', profileIds);

            if (profileError) throw profileError;

            // BƯỚC 3: Kiểm tra xem mình đã follow những người này chưa (để hiện nút cho đúng)
            let myFollowings = [];
            if (currentUser) {
                const { data: myF } = await window.supabaseClient
                    .from('follows')
                    .select('following_id')
                    .eq('follower_id', currentUser.id)
                    .in('following_id', profileIds);
                if (myF) myFollowings = myF.map(f => f.following_id);
            }

            const headerText = tabId === 'followers' ? 'Người theo dõi' : 'Đang theo dõi';

            listContainer.innerHTML = `
                <div class="flex flex-col gap-4">
                    <div class="flex items-center justify-between px-2">
                        <h3 class="font-headline-md text-headline-md text-on-surface">${headerText}</h3>
                        <div class="relative hidden sm:block">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                            <input class="bg-surface-container-low border-none rounded-lg py-2 pl-9 pr-4 text-body-md font-body-md focus:ring-1 focus:ring-primary w-48 sm:w-64" placeholder="Tìm kiếm..." type="text" />
                        </div>
                    </div>
                    <div class="grid grid-cols-1 gap-3">
                        ${profiles.map(p => {
                const isFollowing = myFollowings.includes(p.id);
                return AgrisocialComponents.renderFollowerItem(p, isFollowing);
            }).join('')}
                    </div>
                    <div class="mt-8 flex justify-center">
                        <button class="bg-surface-container-low text-primary font-label-lg text-label-lg px-8 py-3 rounded-full hover:bg-surface-container transition-colors flex items-center gap-2">
                            <span class="material-symbols-outlined text-xl">refresh</span>
                            Tải thêm
                        </button>
                    </div>
                </div>`;
        } catch (err) {
            console.error("Lỗi fetch follow list:", err);
            listContainer.innerHTML = '<div class="p-4 text-center text-error">Lỗi tải danh sách</div>';
        }
    } else if (tabId === 'garden') {
        listContainer.innerHTML = `
            <div class="bg-surface rounded-xl p-8 text-center border border-outline-variant/30 shadow-[0_2px_10px_rgba(46,125,50,0.04)]">
                <span class="material-symbols-outlined text-primary text-5xl mb-3 block">potted_plant</span>
                <p class="font-label-lg text-label-lg text-on-surface mb-2">Khu vườn đang được chăm sóc</p>
                <p class="font-body-md text-body-md text-on-surface-variant">Dữ liệu về các vụ mùa và nhật ký canh tác sẽ xuất hiện tại đây.</p>
            </div>`;
    } else if (tabId === 'about') {
        listContainer.innerHTML = `
            <div class="bg-surface rounded-xl p-6 border border-outline-variant/30 shadow-[0_2px_10px_rgba(46,125,50,0.04)]">
                <h3 class="font-headline-md text-headline-md text-on-surface mb-4">Giới thiệu</h3>
                <div class="flex flex-col gap-4">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined text-primary text-[20px] mt-0.5">person</span>
                        <div><p class="font-label-lg text-label-lg text-on-surface mb-1">Tiểu sử</p><p class="font-body-md text-body-md text-on-surface-variant">Nông dân đam mê công nghệ 🌾</p></div>
                    </div>
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined text-primary text-[20px] mt-0.5">location_on</span>
                        <div><p class="font-label-lg text-label-lg text-on-surface mb-1">Vị trí</p><p class="font-body-md text-body-md text-on-surface-variant">Đồng bằng Sông Cửu Long, Việt Nam</p></div>
                    </div>
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined text-primary text-[20px] mt-0.5">agriculture</span>
                        <div><p class="font-label-lg text-label-lg text-on-surface mb-1">Chuyên môn</p><p class="font-body-md text-body-md text-on-surface-variant">Lúa gạo, Ngô, Kỹ thuật canh tác</p></div>
                    </div>
                </div>
            </div>`;
    } else if (tabId === 'badges') {
        listContainer.innerHTML = `
            <div class="bg-surface rounded-xl p-6 border border-outline-variant/30 shadow-[0_2px_10px_rgba(46,125,50,0.04)]">
                <h3 class="font-headline-md text-headline-md text-on-surface mb-4">Huy hiệu</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div class="flex flex-col items-center gap-2 p-4 bg-surface-container-low rounded-xl">
                        <span class="material-symbols-outlined text-[36px] text-primary" style="font-variation-settings: 'FILL' 1;">military_tech</span>
                        <p class="font-label-lg text-label-lg text-on-surface text-center">Nông dân Pro</p>
                        <p class="font-body-md text-body-md text-on-surface-variant text-[11px] text-center">Top đóng góp</p>
                    </div>
                    <div class="flex flex-col items-center gap-2 p-4 bg-surface-container-low rounded-xl">
                        <span class="material-symbols-outlined text-[36px] text-secondary" style="font-variation-settings: 'FILL' 1;">eco</span>
                        <p class="font-label-lg text-label-lg text-on-surface text-center">Xanh lá</p>
                        <p class="font-body-md text-body-md text-on-surface-variant text-[11px] text-center">10+ bài viết</p>
                    </div>
                    <div class="flex flex-col items-center gap-2 p-4 bg-surface-container-low rounded-xl">
                        <span class="material-symbols-outlined text-[36px] text-tertiary" style="font-variation-settings: 'FILL' 1;">favorite</span>
                        <p class="font-label-lg text-label-lg text-on-surface text-center">Được yêu thích</p>
                        <p class="font-body-md text-body-md text-on-surface-variant text-[11px] text-center">50+ lượt thích</p>
                    </div>
                </div>
            </div>`;
    } else {
        listContainer.innerHTML = `
            <div class="bg-surface rounded-xl p-8 text-center border border-outline-variant/30 shadow-[0_2px_10px_rgba(46,125,50,0.04)]">
                <span class="material-symbols-outlined text-outline text-5xl mb-3 block">construction</span>
                <p class="font-label-lg text-label-lg text-on-surface-variant">Tính năng đang phát triển</p>
            </div>`;
    }
};

window.openEditProfileModal = function () {
    const epModal = document.getElementById('edit-profile-modal');
    if (epModal) {
        if (currentUser) {
            const p = currentUser.profile || currentUser || {};

            const epName = document.getElementById('ep-name');
            if (epName) epName.value = currentUser.full_name || p.full_name || '';

            const epBio = document.getElementById('ep-bio');
            if (epBio) epBio.value = p.bio || '';

            const avatarUrl = currentUser.avatar_url || p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name || 'U')}&background=0d631b&color=fff`;
            const avatarPreview = document.getElementById('ep-avatar-preview');
            if (avatarPreview) avatarPreview.src = avatarUrl;

            const coverUrl = p.cover_url || "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80";
            const coverPreview = document.getElementById('ep-cover-preview');
            if (coverPreview) coverPreview.src = coverUrl;

            const epLocation = document.getElementById('ep-farm-location');
            if (epLocation) epLocation.value = p.farm_location || p.location || '';

            const epArea = document.getElementById('ep-farm-area');
            if (epArea) epArea.value = p.farm_area || 0;

            const epMainCrop = document.getElementById('ep-main-crop');
            if (epMainCrop) epMainCrop.value = p.main_crop || '';

            const epPhone = document.getElementById('ep-phone');
            if (epPhone) epPhone.value = p.phone || '';
        }
        epModal.style.display = 'flex';
    }
};

function setupProfileTabs() {
    const btnCloseEP = document.getElementById('btn-close-ep');
    const btnCancelEP = document.getElementById('btn-cancel-ep');
    const epModal = document.getElementById('edit-profile-modal');
    if (btnCloseEP) btnCloseEP.onclick = () => epModal.style.display = 'none';
    if (btnCancelEP) btnCancelEP.onclick = () => epModal.style.display = 'none';
}

window.toggleFollow = async function (targetId) {
    if (!currentUser || !window.supabaseClient) {
        showToast('Vui lòng đăng nhập để theo dõi chuyên gia', 'info');
        return;
    }
    if (currentUser.id === targetId) return;

    try {
        // Kiểm tra xem đã theo dõi chưa
        const { data: existing, error: checkErr } = await window.supabaseClient
            .from('follows')
            .select('id')
            .eq('follower_id', currentUser.id)
            .eq('following_id', targetId)
            .maybeSingle();

        if (checkErr) throw checkErr;

        if (existing) {
            // Đã theo dõi -> Unfollow (Xóa theo cặp ID vì bảng có thể không có cột id riêng)
            const { error: unfollowErr } = await window.supabaseClient
                .from('follows')
                .delete()
                .eq('follower_id', currentUser.id)
                .eq('following_id', targetId);

            if (unfollowErr) throw unfollowErr;
            showToast('Đã bỏ theo dõi', 'success');
            updateFollowButtonUI(targetId, false);
        } else {
            // Chưa theo dõi -> Follow
            const { error: followErr } = await window.supabaseClient
                .from('follows')
                .insert({
                    follower_id: currentUser.id,
                    following_id: targetId
                });

            if (followErr) throw followErr;
            showToast('Đã theo dõi', 'success');
            updateFollowButtonUI(targetId, true);

            // Thông báo cho người được theo dõi (Nếu có hệ thống thông báo)
            try {
                await window.supabaseClient.from('notifications').insert({
                    user_id: targetId,
                    actor_id: currentUser.id,
                    type: 'follow',
                    is_read: false
                });
            } catch (e) { }
        }

        // Cập nhật lại chỉ số profile nếu đang ở trang profile của mình hoặc của target
        if (typeof renderProfilePage === 'function') {
            const currentProfileId = window.targetProfileId || (currentUser ? currentUser.id : null);
            if (currentProfileId === targetId || currentProfileId === currentUser.id) {
                // Tùy chọn: Gọi lại renderProfilePage() hoặc chỉ update stats
                updateProfileStats();
            }
        }
    } catch (err) {
        console.error("Lỗi toggleFollow:", err);
        showToast('Không thể thực hiện thao tác này', 'error');
    }
};

function updateFollowButtonUI(targetId, isFollowing) {
    const buttons = [
        document.getElementById(`btn-follow-${targetId}`),
        document.getElementById(`btn-follow-list-${targetId}`)
    ];

    buttons.forEach(btn => {
        if (!btn) return;
        if (isFollowing) {
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">person_remove</span> Đang theo dõi';
            btn.classList.remove('bg-primary', 'text-on-primary');
            btn.classList.add('bg-surface-container-highest', 'text-on-surface-variant');
        } else {
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">person_add</span> Theo dõi';
            btn.classList.add('bg-primary', 'text-on-primary');
            btn.classList.remove('bg-surface-container-highest', 'text-on-surface-variant');
        }
    });
}

async function updateProfileStats() {
    if (!currentUser || !window.supabaseClient) return;

    try {
        // Đếm số bài viết
        const { count, error } = await window.supabaseClient
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);

        if (!error) {
            const postCount = count || 0;
            const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
            setText('side-stat-post', postCount);

            // Cập nhật vào cache currentUser
            if (currentUser.profile) {
                if (!currentUser.profile.stats) currentUser.profile.stats = {};
                currentUser.profile.stats.posts = postCount;
            }
        }
    } catch (e) {
        console.error("Lỗi cập nhật chỉ số profile:", e);
    }
}

// ================================================================ //
// =================== NAVIGATION & APP TABS ====================== //
// ================================================================ //

const PAGE_TITLES = {
    'page-community': 'Bảng tin AgriSocial',
    'page-search': 'Khám phá Nông nghiệp',
    'page-expert': 'Hỏi đáp Chuyên gia',
    'page-ai-home': 'AI Nhận diện Cây trồng',
    'page-camera': '📸 Quét AI',
    'page-garden': 'Khu vườn của tôi',
    'page-profile': 'Trang cá nhân',
    'page-library': 'Thư viện Nông nghiệp',
    'page-groups': 'Hội nhóm',
    'page-notifications': 'Thông báo của bạn',
    'page-scan-history': 'Lịch sử nhận diện'
};

function setupBottomNav() {
    document.querySelectorAll('.bnav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const pageId = btn.getAttribute('data-page');
            if (pageId === 'page-profile') window.targetProfileId = null;
            switchTab(pageId);
        });
    });

    // Sidebar listeners
    document.querySelectorAll('.cs-nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const pageId = btn.getAttribute('data-page');
            if (pageId === 'page-profile') window.targetProfileId = null;
            switchTab(pageId);
        });
    });
}

window.switchTab = function (pageId) {
    console.log("DEBUG: switchTab called with pageId:", pageId);
    if (pageId === 'page-ai-home') console.trace("Trace for page-ai-home switch");
    if (!pageId) return;

    // 1. Hiển thị trang ngay lập tức để tránh màn hình trắng
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
        // Cuộn lên đầu trang
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.scrollTop = 0;
    }

    // 2. Cập nhật UI navigation
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.cs-nav-item').forEach(b => b.classList.remove('active'));

    const navBtn = document.querySelector(`.bnav-item[data-page="${pageId}"]`);
    if (navBtn) navBtn.classList.add('active');
    const sideBtn = document.querySelector(`.cs-nav-item[data-page="${pageId}"]`);
    if (sideBtn) sideBtn.classList.add('active');

    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = PAGE_TITLES[pageId] || 'AgriSocial';

    // 3. Lưu trạng thái
    localStorage.setItem('agrisocial_current_page', pageId);
    if (pageId === 'page-profile' && window.targetProfileId) {
        localStorage.setItem('agrisocial_target_profile_id', window.targetProfileId);
    }

    // 4. Nạp dữ liệu (Bọc trong try-catch để tránh crash cả hàm)
    try {
        if (pageId === 'page-profile') renderProfilePage();
        if (pageId === 'page-search') loadExploreContent();
        if (pageId === 'page-community') fetchCommunityFeed();
        if (pageId === 'page-expert') {
            if (typeof fetchExpertQnA === 'function') fetchExpertQnA();
            if (typeof populateExpertDropdown === 'function') populateExpertDropdown('ask-exp-target-expert-page');
        }
        if (pageId === 'page-expert-ask') {
            if (typeof populateExpertDropdown === 'function') populateExpertDropdown('ask-exp-target-expert-page');
        }
        if (pageId === 'page-garden') { if (typeof renderMyGarden === 'function') renderMyGarden(); }
        if (pageId === 'page-scan-history') { if (typeof fetchHistory === 'function') fetchHistory(); }
        if (pageId === 'page-library') { if (typeof renderLibraryPage === 'function') renderLibraryPage(); }
    } catch (err) {
        console.error("Lỗi khi nạp nội dung trang:", pageId, err);
    }

    window.bypassProfileReset = false;
};

// ================================================================ //
// =================== EXPLORE & SEARCH LOGIC ===================== //
// ================================================================ //

// Dữ liệu mẫu cho Tin tức
window.MOCK_NEWS = [
    {
        id: 1,
        title: "Kỹ thuật canh tác Lúa Hè Thu ứng phó hạn mặn 2024",
        summary: "Áp dụng kỹ thuật 'Ướt khô xen kẽ' để tiết kiệm nước và tăng năng suất trong điều kiện biến đổi khí hậu.",
        content: `
            <p>Trong bối cảnh hạn mặn diễn biến phức tạp tại Đồng bằng sông Cửu Long, việc thay đổi phương thức canh tác lúa truyền thống sang các kỹ thuật bền vững là yêu cầu cấp thiết.</p>
            <h3 class="text-2xl font-black text-primary">Kỹ thuật 'Ướt khô xen kẽ' (AWD)</h3>
            <p>Đây là giải pháp được Viện Nghiên cứu Lúa ĐBSCL (CLRRI) thúc đẩy mạnh mẽ. Thay vì giữ mực nước liên tục trên đồng, nông dân sẽ để đất khô tự nhiên đến một ngưỡng nhất định trước khi bơm nước trở lại.</p>
            <ul class="list-disc pl-6 ml-6 space-y-2">
                <li>Tiết kiệm tới 25% lượng nước tưới.</li>
                <li>Giảm phát thải khí nhà kính (metan).</li>
                <li>Giúp rễ lúa ăn sâu, chống đổ ngã tốt hơn.</li>
            </ul>
            <img src="https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=1200&q=80" class="rounded-2xl shadow-lg my-8 w-full" />
            <h3 class="text-2xl font-black text-primary">Lưu ý về lịch thời vụ</h3>
            <p>Nông dân cần theo dõi sát sao bản tin dự báo độ mặn. Chỉ nên xuống giống khi nồng độ mặn dưới 1g/lít.</p>
        `,
        image_url: "https://images.unsplash.com/photo-1505471768190-275e2ad7b3f9?auto=format&fit=crop&w=1200&q=80",
        badge: "TIN NÓNG",
        author: "Ban biên tập AgriSocial",
        date: "12 Tháng 5, 2024",
        tags: ["Lúa gạo", "Hạn mặn", "ĐBSCL"],
        color: "primary"
    }
];

let currentHeroIndex = 0;
let heroInterval = null;

// Hàm khởi tạo Tab Khám phá
window.loadExploreContent = async function () {
    console.log("DEBUG: loadExploreContent triggered");
    window.updateWeatherAndSuggestions(); // Cập nhật thời tiết & Gợi ý

    // Tải tin tức từ Supabase
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('explore_news')
                .select('*')
                .eq('is_hero', true)
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                window.MOCK_NEWS = data;
                currentHeroIndex = 0;
            }
        } catch (err) {
            console.error("Lỗi lấy dữ liệu explore_news:", err);
        }
    }

    window.updateHeroUI();                // Cập nhật Carousel tin tức
    if (!heroInterval) {
        heroInterval = setInterval(window.nextHeroNews, 8000);
    }
    window.renderTrendingCrops();         // Nạp cây trồng xu hướng
    window.renderCollections();           // Nạp bộ sưu tập
    window.renderFocusArticle();          // Nạp bài viết tiêu điểm
    window.renderOtherNewsList();         // Nạp lưới tin tức phụ
};

window.nextHeroNews = function () {
    if (!window.MOCK_NEWS || window.MOCK_NEWS.length === 0) return;
    currentHeroIndex = (currentHeroIndex + 1) % Math.min(window.MOCK_NEWS.length, 5);
    window.updateHeroUI();
};

window.prevHeroNews = function () {
    if (!window.MOCK_NEWS || window.MOCK_NEWS.length === 0) return;
    currentHeroIndex = (currentHeroIndex - 1 + Math.min(window.MOCK_NEWS.length, 5)) % Math.min(window.MOCK_NEWS.length, 5);
    window.updateHeroUI();
    if (heroInterval) {
        clearInterval(heroInterval);
        heroInterval = setInterval(window.nextHeroNews, 8000);
    }
};

window.updateHeroUI = function () {
    if (!window.MOCK_NEWS || window.MOCK_NEWS.length === 0) return;
    const item = window.MOCK_NEWS[currentHeroIndex];
    const card = document.getElementById('explore-hero-card');
    if (!card || !item) return;

    const img = document.getElementById('exp-hero-img');
    const badge = document.getElementById('exp-hero-badge');
    const title = document.getElementById('exp-hero-title');
    const desc = document.getElementById('exp-hero-desc');
    const btnRead = document.getElementById('btn-hero-read');
    const indicators = document.getElementById('hero-indicators');

    card.style.opacity = '0.8';
    setTimeout(() => {
        if (img) {
            img.src = item.image_url || 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1200&q=80';
            img.onerror = function () {
                this.src = 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1200&q=80';
            };
        }
        if (badge) {
            badge.innerHTML = `<span class="material-symbols-outlined text-[14px]">bolt</span> ${item.badge || 'TIN NÓNG'}`;
            badge.className = `w-fit bg-${item.color || 'primary'} text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm border border-white/20 uppercase tracking-widest`;
        }
        if (title) title.innerText = item.title;
        if (desc) desc.innerText = item.summary;
        if (btnRead) btnRead.onclick = () => window.openNewsArticle ? window.openNewsArticle(item.id) : window.showToast("Đang mở bài viết...", "info");

        if (indicators) {
            indicators.innerHTML = window.MOCK_NEWS.slice(0, 5).map((_, i) => `
                <div class="h-1.5 rounded-full transition-all duration-300 ${i === currentHeroIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}"></div>
            `).join('');
        }
        card.style.opacity = '1';
    }, 200);
};

// Logic Thời tiết & Gợi ý hành động
window.updateWeatherAndSuggestions = async function () {
    const monthEl = document.getElementById('calendar-month');
    const tempEl = document.getElementById('weather-temp');
    const descEl = document.getElementById('weather-desc');
    const iconEl = document.getElementById('weather-icon');
    const suggestionContainer = document.getElementById('action-suggestions-container');

    const now = new Date();
    const month = now.getMonth() + 1;
    if (monthEl) monthEl.innerText = `Tháng ${month}`;

    const setFallback = () => {
        if (tempEl && tempEl.innerText === '--°C') tempEl.innerText = "28°C";
        if (descEl) descEl.innerText = "Nắng nhẹ";
        if (suggestionContainer) generateSuggestions(28, 70, month, suggestionContainer);
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relative_humidity_2m`);
                const data = await res.json();
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                const humidity = data.hourly ? data.hourly.relative_humidity_2m[0] : 70;

                if (tempEl) tempEl.innerText = `${temp}°C`;
                if (descEl && window.mapWeatherCode) descEl.innerText = window.mapWeatherCode(code).desc;
                if (iconEl && window.mapWeatherCode) iconEl.innerText = window.mapWeatherCode(code).icon;

                generateSuggestions(temp, humidity, month, suggestionContainer);
            } catch (err) { setFallback(); }
        }, setFallback);
    } else {
        setFallback();
    }
};

window.mapWeatherCode = function (code) {
    const maps = {
        0: { icon: 'light_mode', desc: 'Trời quang' },
        1: { icon: 'partly_cloudy_day', desc: 'Ít mây' },
        2: { icon: 'partly_cloudy_day', desc: 'Mây rải rác' },
        3: { icon: 'cloud', desc: 'Nhiều mây' },
        45: { icon: 'foggy', desc: 'Sương mù' },
        48: { icon: 'foggy', desc: 'Sương muối' },
        51: { icon: 'grain', desc: 'Mưa phùn nhẹ' },
        61: { icon: 'rainy', desc: 'Mưa nhẹ' },
        63: { icon: 'rainy', desc: 'Mưa vừa' },
        65: { icon: 'rainy', desc: 'Mưa to' },
        80: { icon: 'umbrella', desc: 'Mưa rào nhẹ' },
        95: { icon: 'thunderstorm', desc: 'Dông sét' }
    };
    return maps[code] || { icon: 'wb_sunny', desc: 'Nắng nhẹ' };
};

// Hàm tạo gợi ý dựa trên điều kiện môi trường
function generateSuggestions(temp, humidity, month, container) {
    if (!container) return;
    let suggestions = [];

    if (temp > 30) {
        suggestions.push({ icon: "water_drop", color: "blue", text: "Tăng cường tưới tiêu giữ ẩm cho vườn cây." });
    }
    if (month === 5) {
        suggestions.push({ icon: "agriculture", color: "green", text: "Chuẩn bị đất xuống giống lúa Hè Thu." });
    }
    if (suggestions.length === 0) {
        suggestions.push({ icon: "monitoring", color: "primary", text: "Kiểm tra định kỳ và vệ sinh đồng ruộng." });
    }

    container.innerHTML = suggestions.map(s => `
        <div class="flex items-center gap-3 p-3 bg-white rounded-2xl border border-outline-variant/30 hover:shadow-sm transition-all animate-fade-in-up">
            <div class="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[24px]">${s.icon}</span>
            </div>
            <p class="text-[13px] font-bold text-on-surface leading-snug">${s.text}</p>
        </div>
    `).join('');
}

// Hiển thị Cây trồng xu hướng
window.renderTrendingCrops = async function () {
    const container = document.getElementById('trending-crops-container');
    if (!container) return;

    let crops = [];
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('crop_library')
                .select('id, title, crop_type, views, thumbnail_url')
                .order('views', { ascending: false })
                .limit(5);
            if (!error && data) {
                crops = data.map(item => ({
                    id: item.id,
                    name: item.title,
                    category: item.crop_type || 'Cây trồng',
                    views: item.views || 0,
                    img: item.thumbnail_url || 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=400'
                }));
            }
        } catch (err) {
            console.error("Lỗi lấy cây trồng xu hướng từ Supabase:", err);
        }
    }

    // Fallback mock data
    if (crops.length === 0) {
        crops = [
            {
                id: 1, name: "Sầu Riêng Ri6", category: "Trái cây xuất khẩu",
                views: 1250, img: "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&q=80&w=400"
            },
            {
                id: 2, name: "Sen Đá Variegated", category: "Cây kiểng đô thị",
                views: 850, img: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&q=80&w=400"
            },
            {
                id: 3, name: "Dưa Lưới Huỳnh Long", category: "Nông nghiệp sạch",
                views: 420, img: "https://images.unsplash.com/photo-1598449356475-b9f71db7d847?auto=format&fit=crop&q=80&w=400"
            }
        ];
    }

    container.innerHTML = crops.map(crop => `
        <div class="min-w-[220px] bg-white rounded-[32px] border border-outline-variant shadow-sm overflow-hidden snap-start group cursor-pointer hover:shadow-xl transition-all" 
             onclick="window.openCropDetails('${crop.name}')">
            <div class="h-40 relative overflow-hidden">
                <img src="${crop.img}" onerror="if(!this.dataset.failed){ this.dataset.failed=true; this.src='https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=400'; }" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
            </div>
            <div class="p-5">
                <h3 class="font-black text-on-surface text-sm">${crop.name}</h3>
                <p class="text-[10px] text-on-surface-variant font-bold mt-1 uppercase tracking-widest">${crop.category}</p>
                <div class="mt-4 flex items-center justify-between">
                    <span class="text-[11px] font-black text-primary">${crop.views.toLocaleString()} lượt xem</span>
                    <span class="material-symbols-outlined text-primary text-sm">arrow_forward</span>
                </div>
            </div>
        </div>
    `).join('');
};

window.renderCollections = async function () {
    const container = document.getElementById('collections-container');
    if (!container) return;

    let collections = [];
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('explore_collections')
                .select('*')
                .eq('is_featured', true)
                .limit(4);
            if (!error && data) {
                collections = data.map(item => ({
                    title: item.title,
                    count: item.article_count || 0,
                    label: item.label || 'BÀI VIẾT',
                    img: item.image_url || 'https://images.unsplash.com/photo-1597072631034-046648060ec4?auto=format&fit=crop&q=80&w=300'
                }));
            }
        } catch (err) {
            console.error("Lỗi lấy collections từ Supabase:", err);
        }
    }

    // Fallback mock data
    if (collections.length === 0) {
        collections = [
            {
                title: "Cây lọc không khí văn phòng", count: 12, label: "BÀI VIẾT",
                img: "https://images.unsplash.com/photo-1597072631034-046648060ec4?auto=format&fit=crop&q=80&w=300"
            },
            {
                title: "Mẹo trị sâu bệnh hữu cơ", count: 8, label: "HƯỚNG DẪN",
                img: "https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?auto=format&fit=crop&q=80&w=300"
            }
        ];
    }

    container.innerHTML = collections.map(col => `
        <div class="bg-white p-4 rounded-3xl border border-outline-variant hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer flex items-center gap-4 group"
             onclick="window.showToast('Đang mở bộ sưu tập: ${col.title}', 'info')">
            <div class="w-20 h-20 rounded-2xl overflow-hidden shadow-sm flex-shrink-0">
                <img src="${col.img}" onerror="if(!this.dataset.failed){ this.dataset.failed=true; this.src='https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&q=80&w=300'; }" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
            </div>
            <div>
                <h4 class="font-black text-on-surface text-[14px] leading-tight group-hover:text-primary transition-colors">${col.title}</h4>
                <p class="text-[10px] font-bold text-primary mt-1 uppercase tracking-widest">${col.count} ${col.label}</p>
            </div>
        </div>
    `).join('');
};

window.renderFocusArticle = async function () {
    const container = document.getElementById('focus-article-container');
    if (!container) return;

    let focusItem = null;
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('explore_news')
                .select('*')
                .eq('is_hero', false)
                .order('created_at', { ascending: false })
                .limit(1);
            if (!error && data && data.length > 0) {
                focusItem = data[0];
            }
        } catch (err) {
            console.error("Lỗi lấy bài viết tiêu điểm từ Supabase:", err);
        }
    }

    const currentYear = new Date().getFullYear();
    if (!focusItem) {
        focusItem = {
            id: 999,
            title: "Giống lúa năng suất cao ứng phó biến đổi khí hậu",
            summary: "Nghiên cứu mới về các giống lúa chịu mặn và chịu hạn giúp nông dân Đồng bằng sông Cửu Long ổn định sản xuất trong điều kiện khắc nghiệt.",
            image_url: "https://images.unsplash.com/photo-1563212854-463836d52899?auto=format&fit=crop&w=1200&q=80",
            badge: `TIÊU ĐIỂM ${currentYear}`
        };
    }

    container.innerHTML = `
        <div class="relative w-full h-[320px] rounded-[40px] overflow-hidden group cursor-pointer shadow-ambient border border-outline-variant"
             onclick="window.openNewsArticle(${focusItem.id})">
            <img src="${focusItem.image_url || 'https://images.unsplash.com/photo-1563212854-463836d52899?auto=format&fit=crop&w=1200&q=80'}" onerror="this.src='https://images.unsplash.com/photo-1563212854-463836d52899?auto=format&fit=crop&w=1200&q=80'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000">
            <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex flex-col justify-center p-12">
                <div class="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full w-fit mb-4 border border-white/20 backdrop-blur-md">
                    ${focusItem.badge || `TIÊU ĐIỂM ${currentYear}`}
                </div>
                <h2 class="text-white text-3xl font-black max-w-lg leading-tight group-hover:text-primary-container transition-colors">
                    ${focusItem.title}
                </h2>
                <p class="text-white/80 text-sm mt-4 max-w-md line-clamp-3 font-medium">
                    ${focusItem.summary}
                </p>
                <div class="mt-8 flex items-center gap-3 text-white font-black text-sm">
                    ĐỌC CHI TIẾT
                    <span class="material-symbols-outlined group-hover:translate-x-2 transition-transform">arrow_right_alt</span>
                </div>
            </div>
        </div>
    `;
};

// --- DATA & MODALS DÀNH CHO TAB KHÁM PHÁ ---

const SEASONAL_DATA = {
    "Bắc": {
        1: {
            weather: "Tiết trời rét đậm, sương muối vùng cao. Đỉnh điểm mùa khô hanh miền Bắc.",
            plant: ["Su hào", "Bắp cải", "Cà rốt", "Khoai tây", "Tỏi", "Hành tây"],
            care: ["Tủ rơm rạ giữ ấm gốc rau", "Bón phân hữu cơ thúc củ phình to"],
            harvest: ["Rau vụ đông muộn", "Cà chua", "Bông cải xanh"],
            warning: "Cảnh báo sương muối thiêu cháy ngọn non, bệnh thối gốc do lạnh."
        },
        2: {
            weather: "Mưa xuân ẩm ướt lướt thướt, độ ẩm không khí cực cao, thuận lợi cho hạt nảy mầm.",
            plant: ["Gieo cấy lúa Đông Xuân", "Dưa chuột", "Cà tím", "Đậu cô bơ", "Mướp đắng"],
            care: ["Dọn cỏ làm sạch ruộng lúa mới cấy", "Bón thúc đợt 1 phân đạm và lân"],
            harvest: ["Su hào vụ đông củ to", "Cà rốt gieo sớm", "Hành tỏi kiệu"],
            warning: "Chú ý bệnh đạo ôn hại lúa xuân, sương mai hại cà chua vườn màng."
        },
        3: {
            weather: "Ấm áp dần, mưa phùn dứt, độ ẩm đất cao, cây ăn trái nở hoa thụ phấn rộ.",
            plant: ["Ngô xuân chính vụ", "Khoai lang", "Đậu xanh", "Rau ngót", "Mướp hương"],
            care: ["Phun ngừa nấm cho hoa nhãn, vải", "Làm cỏ, xới xáo luống đỗ"],
            harvest: ["Bắp cải cuối vụ", "Rau cải ngọt", "Cà chua chín rộ"],
            warning: "Phòng ngừa sâu tơ hại rau cải, rầy mềm chích hút đọt non."
        },
        4: {
            weather: "Thời tiết chuyển hè ấm nóng, có mưa rào dông kèm lốc xoáy đầu vụ.",
            plant: ["Rau muống ruộng", "Rau đay", "Mồng tơi", "Bầu bí chùm"],
            care: ["Bón phân đón đòng cho lúa", "Làm giàn vững chắc chống gió bão"],
            harvest: ["Khoai tây thu hoạch dứt điểm", "Ngô xuân sớm", "Mận sớm vùng núi"],
            warning: "Cảnh báo bệnh bạc lá lúa, bọ trĩ phá hoại ngọn rau muống."
        },
        5: {
            weather: "Nắng gắt gay gắt, bắt đầu bước vào mùa thu hoạch lúa Đông Xuân.",
            plant: ["Rau dền đỏ", "Rau đay", "Mướp đắng hè", "Rau muống hạt"],
            care: ["Rút nước cạn ruộng lúa trước gặt", "Cắt tỉa cành la vườn quả đón vụ mới"],
            harvest: ["Lúa Đông Xuân chính vụ", "Vải thiều chín sớm", "Mận tam hoa, mơ"],
            warning: "Nguy cơ dông lốc sấm sét dồn dập, ngập úng đất thấp khi mưa rào."
        },
        6: {
            weather: "Tháng nóng nhất năm, nắng nóng đỉnh điểm xen bão lớn đổ bộ.",
            plant: ["Mạ vụ lúa mùa", "Đỗ xanh hè thu", "Rau cải ngọt hè"],
            care: ["Bơm nước chống hạn ruộng mạ", "Lên luống cao phòng ngập vườn màu"],
            harvest: ["Vải thiều chính vụ", "Dưa hấu, dưa lưới ruộng", "Thanh long"],
            warning: "Tránh ngập úng mầm mạ non. Sâu keo mùa thu phá hoại lúa cực mạnh."
        },
        7: {
            weather: "Mưa lớn bão lũ trùng điệp, độ ẩm đất cao ngập úng cục bộ nhiều nơi.",
            plant: ["Cấy lúa mùa muộn", "Khoai lang hè thu", "Rau cải ngồng"],
            care: ["Phun trừ ốc bươu vàng phá mạ cấy", "Bón thúc đẻ nhánh lúa mùa"],
            harvest: ["Nhãn lồng Hưng Yên", "Mướp hương đầu mùa", "Thanh long đợt 2"],
            warning: "Ngập úng thối rễ rau dầm mưa. Ốc bươu vàng phá hại ruộng lúa mới cấy."
        },
        8: {
            weather: "Thời gian mưa ngâu kéo dài mát mẻ, chuẩn bị làm đất trồng rau đông sớm.",
            plant: ["Bắp cải đông gieo sớm", "Súp lơ trắng sớm", "Cà chua đông"],
            care: ["Lên luống bồi đất luống bắp cải con", "Tưới phân hữu cơ vi sinh"],
            harvest: ["Na Chi Lăng thu hoạch rộ", "Thanh long đợt cuối"],
            warning: "Sâu khoang ăn lá, bệnh lở cổ rễ vườn ươm bắp cải con do mưa dầm."
        },
        9: {
            weather: "Tiết thu dịu mát, nắng thu nhẹ hanh hao. Lúa trỗ đón đòng bông vàng.",
            plant: ["Cải ngọt", "Cải cúc", "Cà rốt chính vụ", "Su hào vụ đông"],
            care: ["Bón đón đòng đợt cuối lúa mùa", "Tưới giữ ẩm gốc su hào bằng vòi phun sương"],
            harvest: ["Chuối tiêu tết", "Bưởi da xanh sớm", "Cam đường canh gặt sớm"],
            warning: "Rầy nâu di cư bùng phát trên ruộng lúa trỗ bông, đạo ôn cổ bông hại hạt lúa."
        },
        10: {
            weather: "Chớm lạnh hanh khô khô ráo, gieo cấy vụ rau đông rầm rộ nhất năm.",
            plant: ["Rau màu vụ đông chính", "Hành tỏi Hải Dương", "Kiệu", "Su hào củ"],
            care: ["Xới xáo bón phân thúc su hào đợt 1", "Dọn cỏ mép luống hành tỏi"],
            harvest: ["Thu hoạch lúa vụ mùa", "Bưởi Diễn quả chín vàng", "Cam canh chính vụ"],
            warning: "Bọ nhảy phá rau họ cải ăn lá, sâu xanh da láng đục củ cà rốt."
        },
        11: {
            weather: "Rét lạnh sâu hanh khô khô khan, thích hợp các cây giống ôn đới phát triển.",
            plant: ["Khoai tây vụ chính", "Cà rốt muộn", "Bắp cải vụ đông muộn"],
            care: ["Vun đất cao gốc khoai tây chống gió bão", "Bón đạm đợt cuối cho hành tỏi"],
            harvest: ["Rau màu gieo sớm", "Cam sành Hàm Yên", "Quýt hữu cơ"],
            warning: "Bệnh sương mai mốc sương khoai tây bùng phát mạnh do chênh lệch nhiệt độ ngày đêm."
        },
        12: {
            weather: "Rét buốt hanh khô khắc nghiệt, sương muối rơi nhiều vùng thung lũng núi cao.",
            plant: ["Mạ Đông Xuân sớm", "Rau mùi tết", "Cúc vạn thọ tết"],
            care: ["Che nilon trắng luống mạ chống rét", "Tưới sương buổi sớm rửa trôi sương muối"],
            harvest: ["Su hào, bắp cải vụ đông", "Cam sành chính vụ", "Hoa tết"],
            warning: "Rét hại thối rễ cây con, sương muối cháy ngọn đọt non cà chua sầu riêng."
        }
    },
    "Trung": {
        1: {
            weather: "Thời tiết se lạnh dễ chịu, thỉnh thoảng có mưa rào nhỏ ẩm ướt.",
            plant: ["Lúa Đông Xuân miền Trung", "Đậu phộng xuân", "Ớt cay chỉ thiên", "Cà chua"],
            care: ["Làm cỏ đợt 1 cho đậu phộng", "Tưới thúc đạm nhẹ cho lúa trổ"],
            harvest: ["Rau xà lách cải bẹ", "Hành lá", "Củ cải trắng"],
            warning: "Sâu tơ hại rau cải, bệnh lở cổ rễ trên cây đậu phộng."
        },
        2: {
            weather: "Nhiệt độ ấm dần, ẩm độ vừa phải. Cây ăn trái nở hoa thụ phấn rộ.",
            plant: ["Ngô xuân muộn", "Khoai lang cát", "Bí đỏ quả to", "Rau muống hạt"],
            care: ["Cắt cành vô hiệu cho vườn cây ăn quả", "Vun đất luống ngô đợt 1"],
            harvest: ["Cà chua chín đỏ ngọt", "Khoai lang gieo vụ đông"],
            warning: "Bệnh rỉ sắt hại ngô, rầy chích hút bông xoài non."
        },
        3: {
            weather: "Nắng ráo dịu mát ôn hòa, chuẩn bị đất cho hoa màu hè thu sớm.",
            plant: ["Mè (vừng) vụ xuân", "Đậu xanh", "Dưa hấu sớm", "Rau ngót bụi"],
            care: ["Bơm nước tưới chống hạn vườn dưa", "Bón thúc đợt 2 lúa đông xuân trổ bông"],
            harvest: ["Thu hoạch đậu phộng xuân sớm", "Ớt cay đợt 1"],
            warning: "Bọ trĩ hại dưa hấu, sâu xanh da láng ăn lá đậu xanh."
        },
        4: {
            weather: "Nắng bắt đầu gắt, dông khô kèm giông sét xuất hiện bất chợt.",
            plant: ["Rau dền", "Mồng tơi giàn", "Mướp đắng hè", "Bầu sao"],
            care: ["Giữ nước ruộng lúa chín sữa", "Tưới ẩm đệm gốc thanh long"],
            harvest: ["Thu hoạch lúa Đông Xuân", "Thu dứt điểm mè xuân"],
            warning: "Mưa dông dông lốc giật sập giàn bầu bí, nguy cơ ngập nhẹ thung lũng."
        },
        5: {
            weather: "Nắng nóng gay gắt kèm gió Tây Nam (Gió Lào) thổi khô khô cằn.",
            plant: ["Vừng chịu hạn", "Dưa hấu hè thu", "Khoai lang cát muộn"],
            care: ["Tưới đệm ban đêm tránh sốc nhiệt", "Phủ bạt rơm rạ gốc thanh long, bưởi"],
            harvest: ["Lúa Đông Xuân trễ dứt điểm", "Xoài cát", "Thanh long ruột đỏ"],
            warning: "Hạn mặn nội đồng cực kỳ nghiêm trọng, cháy sém đọt non cam quýt."
        },
        6: {
            weather: "Nắng khô cằn rát da, thỉnh thoảng mưa rào dông lớn làm dịu mát.",
            plant: ["Gieo sạ lúa Hè Thu", "Mè vụ hè thu chính", "Đậu xanh vụ muộn"],
            care: ["Tập trung giữ nước ruộng lúa Hè Thu mới sạ", "Vun đắp luống dưa hấu"],
            warning: "Cảnh báo sâu keo mùa thu phá lúa mạ, dông sét gió lốc gãy cành cây ăn quả."
        },
        7: {
            weather: "Nhiệt độ rất cao xen lẫn các đợt mưa lớn ngập úng do áp thấp nhiệt đới.",
            plant: ["Rau muống hạt hè", "Bí đao leo giàn", "Cải ngọt chịu nhiệt"],
            care: ["Phun trừ sâu keo lúa hè thu đợt đẻ nhánh", "Khơi thông rãnh thoát nước vườn quả"],
            harvest: ["Dưa hấu hè thu ngọt lịm", "Ớt chỉ thiên đợt cuối"],
            warning: "Ngập úng thối gốc rễ rau dầm mưa dông dồn dập."
        },
        8: {
            weather: "Mưa lớn bão lũ dồn dập, chuẩn bị bước vào mùa mưa bão lớn dải đất miền Trung.",
            plant: ["Cải thìa gieo khay", "Hành lá chậu", "Rau mùi chậu"],
            care: ["Bảo vệ che chắn vườn ươm giống", "Bơm thoát lũ khẩn cấp vườn bưởi"],
            harvest: ["Lúa Hè Thu gặt sớm tránh lũ", "Thanh long"],
            warning: "Bão lớn kèm lũ quét ngập sâu. Ốc bươu vàng phá hoại ruộng ngập."
        },
        9: {
            weather: "Bão lũ đổ bộ liên tục, lượng mưa cực lớn gây lũ lụt ngập úng nghiêm trọng.",
            plant: ["Các loại rau ăn lá ôn đới trồng chậu"],
            care: ["Gia cố cọc chằng chống cây ăn quả khỏi ngã đổ", "Rút nước triệt để vùng trũng"],
            harvest: ["Vườn quả thu hoạch sớm chạy bão"],
            warning: "Thiên tai lũ lụt ngập úng thối trắng rễ hoa quả."
        },
        10: {
            weather: "Mưa ẩm kéo dài lê thê sau bão dông, đất ẩm sũng mát mẻ se lạnh dần.",
            plant: ["Khoai lang đông", "Đậu cô bơ vụ đông", "Củ cải đỏ gieo hạt"],
            care: ["Xới đất phá váng chống nghẹt rễ sau lụt", "Bón vôi khử chua cải tạo đất"],
            warning: "Bệnh nấm rễ xì mủ cam bưởi, lở cổ rễ rau màu non."
        },
        11: {
            weather: "Mát mẻ hanh nhẹ se lạnh se khô, bước vào vụ trồng hoa tết kiểng.",
            plant: ["Hoa tết cúc kiểng", "Hành tỏi miền Trung vụ chính", "Su hào ôn đới gieo sương"],
            care: ["Bón kali đợt đầu kích rễ hành tỏi", "Tưới bón thúc nụ hoa tết"],
            harvest: ["Cam bưởi miền Trung", "Kiệu tết gieo sớm"],
            warning: "Rệp sáp hại cam bưởi, bệnh đốm lá rỉ sắt hành tỏi."
        },
        12: {
            weather: "Mưa lạnh rét lạnh khô se se lạnh thổi mạnh sát bờ biển.",
            plant: ["Mạ lúa Đông Xuân", "Su hào củ trễ", "Xà lách ăn tết"],
            care: ["Tưới nước giữ ấm buổi đêm", "Ủ phân vi sinh cải tạo tơi xốp đất"],
            harvest: ["Su hào đông miền Trung", "Hành lá", "Hoa tết cúc đại đóa"],
            warning: "Rét hại sương lạnh cháy mép lá cây ăn trái con, bệnh thối gốc cổ rễ."
        }
    },
    "Nam": {
        1: {
            weather: "Thời tiết nắng ráo dịu mát buổi tối, nhiệt độ ban ngày ấm nóng khô ráo mùa khô.",
            plant: ["Lúa Đông Xuân miền Nam", "Dưa hấu tết chính vụ", "Dưa lưới", "Xoài tết"],
            care: ["Bơm nước tưới dưỡng trái xoài non", "Bón đón đòng đợt cuối lúa đông xuân"],
            harvest: ["Xoài cát trúng mùa", "Dưa lưới hữu cơ", "Sầu riêng vụ nghịch quả trái"],
            warning: "Nguy cơ xâm nhập mặn vùng cửa sông bến lội ĐBSCL, bọ trĩ phá lá non sầu riêng."
        },
        2: {
            weather: "Mùa nắng nóng bắt đầu khô hạn gay gắt, mặn xâm nhập sâu nội đồng ruộng.",
            plant: ["Khoai lang Bình Tân", "Đậu phộng xuân hè", "Dưa leo chịu nắng", "Mướp khía"],
            care: ["Kiểm tra độ mặn nguồn nước trước khi tưới", "Bón kali đợt đầu cho khoai lang lấy củ"],
            harvest: ["Dưa hấu bán tết trúng giá", "Bưởi năm roi trái vụ", "Nhãn chín rộ"],
            warning: "Hạn mặn nghiêm trọng khô hạn vườn sầu riêng bơ, sâu đục thân hại ngô hè."
        },
        3: {
            weather: "Nắng khô nóng gay gắt tột cùng, hạn mặn đỉnh điểm toàn vùng Tây Nam Bộ.",
            plant: ["Cây chịu mặn tốt (Dừa xiêm, vú sữa)"],
            care: ["Tủ lá khô gốc giữ ẩm sầu riêng mít", "Bơm nước ngọt dự trữ ao mương vườn"],
            harvest: ["Sầu riêng trái vụ nghịch", "Thanh long đợt 1 mùa khô"],
            warning: "Cháy lá xém lá do nhiễm mặn rụng lá rễ héo úa sầu riêng mẫn cảm mặn."
        },
        4: {
            weather: "Thời tiết oi bức ngột ngạt cực kỳ nóng, xuất hiện các đợt mưa dông chuyển mùa lớn.",
            plant: ["Chuẩn bị hạt giống lúa Hè Thu", "Măng cụt trái sớm", "Chôm chôm"],
            care: ["Làm sạch rãnh ao hồ mương máng chuẩn bị chứa nước mưa", "Cắt bỏ trái xoài đèo"],
            harvest: ["Thanh long ruột trắng", "Sầu riêng chín sớm"],
            warning: "Mưa dông kèm sấm sét lốc xoáy thổi rụng cành rụng bông sầu riêng non."
        },
        5: {
            weather: "Bắt đầu bước vào mùa mưa dầm dầm dập nhiệt độ giảm oi ẩm tăng cao.",
            plant: ["Sạ lúa Hè Thu", "Sầu riêng chính vụ chín rộ", "Măng cụt", "Chôm chôm", "Bơ"],
            care: ["Bón phân hữu cơ và lân đầu mùa mưa kích rễ quả", "Cày xới luống cao chống úng gốc rau"],
            harvest: ["Sầu riêng Ri6 chính vụ ngọt đậm", "Măng cụt chín tím", "Chôm chôm chín đỏ"],
            warning: "Cảnh báo nứt thân xì mủ thối gốc thối quả do nấm sầu riêng mùa mưa ẩm thấp."
        },
        6: {
            weather: "Mưa dầm dập dốc, độ ẩm không khí rất cao đất ẩm sũng ao nước.",
            plant: ["Mướp hương giàn", "Khổ qua rừng", "Rau đay mồng tơi vườn ẩm"],
            care: ["Bơm tháo nước mương vườn cây ăn quả", "Phun ngừa nấm Phytophthora bưởi da xanh"],
            warning: "Ngập úng thối cổ rễ thối quả dưa hấu dưa leo trồng trũng."
        },
        7: {
            weather: "Mưa bão lớn dồn dập, sóng gió biển lốc xoáy miền Tây.",
            plant: ["Lúa Thu Đông vụ 3 sớm", "Đậu phộng hè thu trễ"],
            care: ["Vun gốc bón phân lót dừa xiêm", "Cắt tỉa nhánh non vô hiệu sầu riêng"],
            harvest: ["Chôm chôm nhãn xuồng", "Sầu riêng cuối vụ chín muộn"],
            warning: "Gió bão dông lớn giật đổ gãy nhánh vườn sầu riêng quả to bưởi nặng trĩu."
        },
        8: {
            weather: "Mùa mưa ngâu dông lốc mát mẻ, lượng nước ngọt mương dồi dào.",
            plant: ["Lúa vụ Thu Đông chính", "Mè mùa mưa", "Khoai mì"],
            care: ["Bón phân thúc đẻ nhánh lúa mùa vụ 3", "Bón kali đợt cuối khoai lang"],
            harvest: ["Nhãn da bò chín rộ", "Thanh long mùa khô đợt cuối"],
            warning: "Ốc bưu vàng bùng phát cắn trụi lá sạ non lúa vụ 3."
        },
        9: {
            weather: "Bắt đầu mùa nước nổi tràn sông Tiền sông Hậu mát mẻ đất phù sa bồi đắp.",
            plant: ["Bông điên điển sông rạch", "Rau nhút đầm", "Rau muống đồng nước nổi"],
            care: ["Đắp đê bao lửng ruộng vườn quả tránh tràn", "Khai thác cá đồng phù sa giữ ao"],
            harvest: ["Cam xoàn ngon ngọt trúng mùa", "Bưởi da xanh tết gieo sớm"],
            warning: "Sạt lở đê bao sụt lún mé mương bao vườn cây ăn trái miền Tây."
        },
        10: {
            weather: "Mùa nước nổi dâng cao mát mẻ trong lành mát rượi phù sa đỏ nặng trĩu phù sa.",
            plant: ["Xà lách rau má chậu cao tránh ngập ruộng thấp"],
            care: ["Bơm tống thoát mương bao vườn quả trũng", "Giữ sạch gốc cây tránh thối nhũn"],
            harvest: ["Bưởi Năm Roi ngon ngọt", "Mận An Phước quả chín đỏ chùm"],
            warning: "Ngập úng thối gốc rễ mít sầu riêng mẫn cảm ngập lâu ngày."
        },
        11: {
            weather: "Nước rút dần ráo ruộng mát lạnh hanh se buổi sớm gió chướng thổi.",
            plant: ["Sạ lúa Đông Xuân sớm chạy lũ", "Dưa hấu gieo sớm đón tết", "Cải cúc"],
            care: ["Bón vôi vệ sinh đất khử chua ruộng lúa rút lũ", "Cày xới phơi ải đất gieo màu"],
            harvest: ["Cam xoàn chín rộ", "Thanh long chong đèn nghịch vụ sớm"],
            warning: "Sâu tơ sâu vẽ bùa bùng phát hại mầm lá non cải đọt non xoài."
        },
        12: {
            weather: "Gió chướng chổi lạnh mát ráo buổi đêm se se lạnh thích hợp hoa màu tết.",
            plant: ["Cấy hoa vạn thọ hoa cúc tết chính vụ", "Dưa hấu ruộng tết chính"],
            care: ["Bơm tưới đều nước giữ độ ẩm đất dưa hấu tết", "Kích bông hoa sứ kiểng hoa mai"],
            harvest: ["Xoài nghịch vụ chín ngọt", "Thanh long chong đèn trái vụ", "Bưởi da xanh tết"],
            warning: "Rầy phấn trắng hại sầu riêng, bọ trĩ phá hoại hoa kiểng cúc tết bùng phát."
        }
    }
};

let scCurrentRegion = 'Nam'; // Default to South Vietnam

window.openCropDetails = async function (cropName) {
    try {
        const res = await fetch(`/api/explore/crops/${encodeURIComponent(cropName)}`);
        const result = await res.json();
        if (!result.success || !result.data) {
            window.showToast("Không tìm thấy thông tin chi tiết cây trồng", "warning");
            return;
        }

        const data = result.data;
        const modal = document.getElementById('crop-detail-modal');
        if (!modal) return;

        // Banner & Title
        const img = document.getElementById('cd-crop-img');
        if (img) {
            img.src = (data.gallery && data.gallery.length > 0) ? data.gallery[0] : 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=600';
        }
        document.getElementById('cd-crop-name').innerText = data.vi || cropName;
        document.getElementById('cd-crop-scientific').innerText = data.ten_khoa_hoc || '';

        // Taxonomy
        document.getElementById('cd-tax-name').innerText = data.ten_khoa_hoc || '---';
        document.getElementById('cd-tax-bo').innerText = data.bo || '---';
        document.getElementById('cd-tax-ho').innerText = data.ho || '---';
        document.getElementById('cd-tax-loai').innerText = data.loai || '---';

        // Description
        document.getElementById('cd-crop-desc').innerText = data.mo_ta || 'Chưa có mô tả.';

        // Cultivation Conditions
        document.getElementById('cd-cond-water').innerText = (data.dieu_kien && data.dieu_kien.nuoc) ? data.dieu_kien.nuoc : 'Theo nhu cầu của cây.';
        document.getElementById('cd-cond-soil').innerText = (data.dieu_kien && data.dieu_kien.dat) ? data.dieu_kien.dat : 'Đất tơi xốp, thoát nước tốt.';

        // Common Diseases
        const diseasesContainer = document.getElementById('cd-crop-diseases');
        if (diseasesContainer) {
            if (data.sau_benh && data.sau_benh.length > 0) {
                diseasesContainer.innerHTML = data.sau_benh.map(sb => `
                    <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 flex flex-col gap-1">
                        <strong class="text-xs text-on-surface flex items-center gap-1">
                            <span class="material-symbols-outlined text-red-500 text-[14px]">bug_report</span> ${sb.ten}
                        </strong>
                        <p class="text-[11px] text-on-surface-variant font-medium mt-1 leading-relaxed">${sb.mo_ta}</p>
                    </div>
                `).join('');
            } else {
                diseasesContainer.innerHTML = '<p class="text-xs text-on-surface-variant italic">Không có thông tin sâu bệnh đặc thù.</p>';
            }
        }

        // Expert Tip
        document.getElementById('cd-expert-tip').innerText = data.meo_chuyen_gia || 'Chăm sóc cây đều đặn, tỉa lá úa và theo dõi tình hình sâu bệnh thường xuyên.';

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } catch (err) {
        console.error("Lỗi mở chi tiết cây trồng:", err);
        window.showToast("Không thể tải thông tin cây trồng", "error");
    }
};

window.closeCropDetails = function () {
    const modal = document.getElementById('crop-detail-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
};

window.openSeasonalCalendar = function () {
    const modal = document.getElementById('seasonal-calendar-modal');
    if (!modal) return;

    // Set default month select to current month
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const monthSelect = document.getElementById('sc-month-select');
    if (monthSelect) {
        monthSelect.value = currentMonth.toString();
    }

    window.updateSeasonalCalendarData();

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeSeasonalCalendar = function () {
    const modal = document.getElementById('seasonal-calendar-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
};

window.switchSeasonalRegion = function (region) {
    scCurrentRegion = region;

    // Toggle active classes on region buttons
    const btnNorth = document.getElementById('sc-btn-north');
    const btnCentral = document.getElementById('sc-btn-central');
    const btnSouth = document.getElementById('sc-btn-south');

    const activeClass = 'px-4 py-1.5 rounded-full text-xs font-black bg-primary text-white border border-primary transition-all';
    const inactiveClass = 'px-4 py-1.5 rounded-full text-xs font-black bg-white text-on-surface border border-outline-variant transition-all';

    if (btnNorth) btnNorth.className = (region === 'Bắc') ? activeClass : inactiveClass;
    if (btnCentral) btnCentral.className = (region === 'Trung') ? activeClass : inactiveClass;
    if (btnSouth) btnSouth.className = (region === 'Nam') ? activeClass : inactiveClass;

    window.updateSeasonalCalendarData();
};

window.updateSeasonalCalendarData = function () {
    const monthSelect = document.getElementById('sc-month-select');
    if (!monthSelect) return;
    const monthVal = parseInt(monthSelect.value);

    const regionData = SEASONAL_DATA[scCurrentRegion];
    let data = regionData ? regionData[monthVal] : null;

    // Fallback if that specific month is not in regionData
    if (!data) {
        data = SEASONAL_DATA["Bắc"][monthVal];
    }

    if (!data) return;

    // Update weather icon, region title, and summary
    document.getElementById('sc-region-title').innerText = `Lịch vụ mùa tại Miền ${scCurrentRegion} - Tháng ${monthVal}`;
    document.getElementById('sc-weather-summary').innerText = data.weather;

    // Set weather icon based on weather description
    const weatherIcon = document.getElementById('sc-weather-icon');
    if (weatherIcon) {
        if (data.weather.includes('rét') || data.weather.includes('lạnh')) {
            weatherIcon.innerText = 'ac_unit';
            weatherIcon.style.color = '#38bdf8'; // Sky blue
        } else if (data.weather.includes('mưa') || data.weather.includes('ẩm')) {
            weatherIcon.innerText = 'rainy';
            weatherIcon.style.color = '#0284c7'; // Sky blue dark
        } else {
            weatherIcon.innerText = 'light_mode';
            weatherIcon.style.color = '#f59e0b'; // Amber
        }
    }

    // Render Plant list
    const listPlant = document.getElementById('sc-list-plant');
    if (listPlant) {
        listPlant.innerHTML = data.plant.map(item => `<li>${item}</li>`).join('');
    }

    // Render Care list
    const listCare = document.getElementById('sc-list-care');
    if (listCare) {
        listCare.innerHTML = data.care.map(item => `<li>${item}</li>`).join('');
    }

    // Render Harvest list
    const listHarvest = document.getElementById('sc-list-harvest');
    if (listHarvest) {
        listHarvest.innerHTML = data.harvest.map(item => `<li>${item}</li>`).join('');
    }

    // Render Warning
    document.getElementById('sc-warning-text').innerText = data.warning;
};

window.renderOtherNewsList = async function () {
    const container = document.getElementById('news-list-container');
    if (!container) return;

    let news = [];
    if (window.supabaseClient) {
        try {
            // Lấy tất cả tin tức trong explore_news mà không phải là hero banner chính
            const { data, error } = await window.supabaseClient
                .from('explore_news')
                .select('*')
                .eq('is_hero', false)
                .order('created_at', { ascending: false });

            if (!error && data) {
                news = data;
            }
        } catch (err) {
            console.error("Lỗi lấy danh sách tin tức phụ từ Supabase:", err);
        }
    }

    if (news.length === 0) {
        news = [
            {
                id: 101,
                title: "Kỹ thuật canh tác mướp đắng đạt hiệu quả kinh tế cao",
                summary: "Chia sẻ cách chọn giống mướp đắng quả dài, chăm sóc từ giai đoạn dây leo đến khi thụ phấn thu hoạch vụ hè thu.",
                image_url: "https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=600&q=80",
                badge: "HƯỚNG DẪN",
                author: "Kỹ sư Trần An",
                date: "3 ngày trước"
            },
            {
                id: 102,
                title: "Phòng ngừa ngập úng vườn sầu riêng trong mùa mưa lớn",
                summary: "Cách tạo rãnh thoát nước mặt vườn quả ĐBSCL để phòng tránh thối rễ sầu riêng do độ ẩm đất dâng cao kéo dài.",
                image_url: "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=600&q=80",
                badge: "PHÒNG TRỪ DỊCH BỆNH",
                author: "TS. Nguyễn Minh",
                date: "5 ngày trước"
            }
        ];
    }

    container.innerHTML = news.map(item => `
        <div onclick="window.openNewsArticle(${typeof item.id === 'string' ? `'${item.id}'` : item.id})" 
             class="bg-white rounded-[32px] border border-outline-variant p-5 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer flex flex-col md:flex-row gap-5 group">
            <div class="w-full md:w-32 h-32 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 relative">
                <img src="${item.image_url || 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=400'}" onerror="this.src='https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=400'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-2 left-2 bg-primary text-white text-[8px] font-black px-2 py-0.5 rounded-full border border-white/20 uppercase tracking-widest">${item.badge || 'TIN TỨC'}</span>
            </div>
            <div class="flex flex-col justify-between py-1">
                <div>
                    <h3 class="font-black text-on-surface text-[15px] leading-tight group-hover:text-primary transition-colors line-clamp-2">${item.title}</h3>
                    <p class="text-xs text-on-surface-variant font-medium mt-2 line-clamp-2 leading-relaxed">${item.summary}</p>
                </div>
                <div class="flex items-center gap-3 text-[10px] text-on-surface-variant font-bold mt-4">
                    <span>👤 ${item.author || 'AgriSocial'}</span>
                    <span>•</span>
                    <span>📅 ${item.date || 'Hôm nay'}</span>
                </div>
            </div>
        </div>
    `).join('');
};

window.switchExploreCategory = window.loadExploreContent;

// ================================================================ //
// =================== ARTICLE MODAL LOGIC ======================== //
// ================================================================ //

window.openArticleDetail = async function (articleId) {
    const modal = document.getElementById('article-modal');
    const body = document.getElementById('article-modal-body');
    const title = document.getElementById('article-modal-title');

    if (!modal || !body) return;

    title.innerText = "Kiến thức nông nghiệp";
    body.innerHTML = `
        <div class="p-12 text-center">
            <div class="inline-block w-12 h-12 border-4 border-agrisocial-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p class="text-neutral-500 font-bold text-lg">Đang nạp dữ liệu...</p>
        </div>
    `;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
        let article = null;
        if (window.exploreArticlesCache) {
            article = window.exploreArticlesCache.find(a => String(a.id) === String(articleId));
        }

        if (!article) {
            const res = await fetch(`/api/explore/content`);
            const articles = await res.json();
            window.exploreArticlesCache = articles;
            article = articles.find(a => String(a.id) === String(articleId));
        }

        if (!article) throw new Error("Không tìm thấy dữ liệu bài viết này.");

        title.innerText = article.category || "Cây trồng & Kỹ thuật";
        const initial = (article.author || 'U').charAt(0).toUpperCase();

        body.innerHTML = `
            <div class="article-content-view animate-fade-in">
                <h1 class="text-2xl sm:text-4xl font-black text-neutral-800 mb-6 leading-tight">${article.title}</h1>
                
                <div class="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-100">
                    <div class="w-12 h-12 rounded-2xl bg-agrisocial-primary text-white flex items-center justify-center font-black shadow-lg">
                        ${article.author_avatar ? `<img src="${article.author_avatar}" class="w-full h-full rounded-2xl object-cover">` : initial}
                    </div>
                    <div>
                        <div class="font-bold text-neutral-800 flex items-center gap-1">
                            ${article.author} 
                            ${article.is_expert ? '<span class="text-blue-500 text-[10px]">✔</span>' : ''}
                        </div>
                        <div class="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">${article.time_ago} • ${article.category.toUpperCase()}</div>
                    </div>
                </div>

                <div class="rounded-3xl overflow-hidden mb-8 shadow-xl">
                    <img src="${article.image_url}" class="w-full object-cover max-h-[500px]" onerror="this.src='https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'">
                </div>

                <div class="prose-custom">
                    <p class="text-lg text-neutral-700 leading-relaxed mb-6">
                        ${article.summary.replace(/\n/g, '<br><br>')}
                    </p>
                    <div class="mt-8 p-6 bg-green-50 rounded-2xl border-l-4 border-agrisocial-primary italic text-green-800">
                        Bài viết được chia sẻ từ cộng đồng chuyên gia AgriSocial. Chúc bà con sản xuất hiệu quả!
                    </div>
                </div>
                
                <div class="mt-12 pt-8 border-t border-neutral-100 flex items-center justify-between pb-6">
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-1 text-agrisocial-primary font-bold">
                            <span>👍</span> ${article.likes} Thích
                        </div>
                    </div>
                </div>
            </div>
        `;

        body.scrollTop = 0;

    } catch (err) {
        body.innerHTML = `
            <div class="p-20 text-center">
                <div class="text-6xl mb-6">🏜️</div>
                <h3 class="text-2xl font-black text-neutral-800 mb-2">Không tìm thấy nội dung</h3>
                <p class="text-neutral-500 mb-8 max-w-xs mx-auto">${err.message}</p>
                <button onclick="closeArticleModal()" class="px-10 py-4 bg-neutral-100 rounded-2xl text-neutral-700 font-black hover:bg-neutral-200 transition-all">Quay lại</button>
            </div>
        `;
    }
};

window.closeArticleModal = function (e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById('article-modal');
    if (modal) {
        modal.classList.add('animate-fade-out');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('animate-fade-out');
            document.body.style.overflow = 'auto';
        }, 200);
    }
};

// ================================================================ //
// =================== OTHER UTILS & EMPTY STUBS ================== //
// ================================================================ //

// --- KHU VƯỜN CỦA TÔI MANAGEMENT SYSTEM ---
function getMyGarden() {
    try {
        return JSON.parse(localStorage.getItem('my_garden') || '[]');
    } catch (e) {
        return [];
    }
}

function saveMyGarden(garden) {
    localStorage.setItem('my_garden', JSON.stringify(garden));
}

// Map crop names to realistic stage-specific Unsplash photos
const CROP_STAGE_IMAGES = {
    "lúa": {
        sprout: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80",
        growing: "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=400&q=80",
        flowering: "https://images.unsplash.com/photo-1568241723642-e1104e7c3e53?auto=format&fit=crop&w=400&q=80",
        harvest: "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=400&q=80"
    },
    "ngô": {
        sprout: "https://images.unsplash.com/photo-1524247076214-722a46fa7a4e?auto=format&fit=crop&w=400&q=80",
        growing: "https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?auto=format&fit=crop&w=400&q=80",
        flowering: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80",
        harvest: "https://images.unsplash.com/photo-1601648764658-cf37e8c89b70?auto=format&fit=crop&w=400&q=80"
    },
    "bắp": {
        sprout: "https://images.unsplash.com/photo-1524247076214-722a46fa7a4e?auto=format&fit=crop&w=400&q=80",
        growing: "https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?auto=format&fit=crop&w=400&q=80",
        flowering: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80",
        harvest: "https://images.unsplash.com/photo-1601648764658-cf37e8c89b70?auto=format&fit=crop&w=400&q=80"
    },
    "cà chua": {
        sprout: "https://images.unsplash.com/photo-1604762524889-3e2fcc145683?auto=format&fit=crop&w=400&q=80",
        growing: "https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=400&q=80",
        flowering: "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=400&q=80",
        harvest: "https://images.unsplash.com/photo-1524593689594-aae2f26b75ab?auto=format&fit=crop&w=400&q=80"
    },
    "đậu phộng": {
        sprout: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=400&q=80",
        growing: "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&w=400&q=80",
        flowering: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80",
        harvest: "https://images.unsplash.com/photo-1515150144380-bca9f1650ed9?auto=format&fit=crop&w=400&q=80"
    },
    "bông cao lương": {
        sprout: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80",
        growing: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=400&q=80",
        flowering: "https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=400&q=80",
        harvest: "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=400&q=80"
    },
    "default": {
        sprout: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=400&q=80",
        growing: "https://images.unsplash.com/photo-1463936575829-25148e1db1b8?auto=format&fit=crop&w=400&q=80",
        flowering: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80",
        harvest: "https://images.unsplash.com/photo-1523301343968-6a6ebfc64d63?auto=format&fit=crop&w=400&q=80"
    }
};

function getStageImage(plantName, progress) {
    const nameLower = (plantName || "").toLowerCase();
    let key = "default";
    for (const k of Object.keys(CROP_STAGE_IMAGES)) {
        if (k !== "default" && nameLower.includes(k)) {
            key = k;
            break;
        }
    }
    const stages = CROP_STAGE_IMAGES[key];
    if (progress < 40) return stages.sprout;
    if (progress < 70) return stages.growing;
    if (progress < 95) return stages.flowering;
    return stages.harvest;
}

// Canvas particle animations for watering and fertilizing
window.playWaterAnimation = function (index) {
    const canvas = document.getElementById(`canvas-care-${index}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const particles = [];
    const maxParticles = 40;

    for (let i = 0; i < maxParticles; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * -50,
            vy: 4 + Math.random() * 4,
            vx: -1 + Math.random() * 2,
            radius: 2 + Math.random() * 2,
            color: 'rgba(59, 130, 246, ' + (0.4 + Math.random() * 0.4) + ')',
            splashed: false,
            splashTimer: 0
        });
    }

    let startTime = Date.now();

    function animate() {
        if (Date.now() - startTime > 1500) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;

        particles.forEach(p => {
            if (!p.splashed) {
                p.y += p.vy;
                p.x += p.vx;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();

                const groundY = canvas.height * 0.8;
                if (p.y >= groundY) {
                    p.splashed = true;
                    p.splashTimer = 10;
                }
                active = true;
            } else if (p.splashTimer > 0) {
                p.splashTimer--;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, (10 - p.splashTimer) * 1.5, 0, Math.PI * 2);
                ctx.stroke();
                active = true;
            }
        });

        if (active) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    animate();
};

window.playFertilizeAnimation = function (index) {
    const canvas = document.getElementById(`canvas-care-${index}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const particles = [];
    const maxParticles = 25;

    for (let i = 0; i < maxParticles; i++) {
        particles.push({
            x: canvas.width * 0.2 + Math.random() * (canvas.width * 0.6),
            y: canvas.height * 0.8 + Math.random() * 20,
            vy: -(1.5 + Math.random() * 2),
            vx: -0.5 + Math.random() * 1,
            size: 3 + Math.random() * 5,
            color: `rgba(249, 115, 22, ${0.6 + Math.random() * 0.4})`,
            alpha: 1,
            decay: 0.015 + Math.random() * 0.01
        });
    }

    let startTime = Date.now();

    function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, fillStyle) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius)
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }

    function animate() {
        if (Date.now() - startTime > 1500) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;

        particles.forEach(p => {
            if (p.alpha > 0) {
                p.y += p.vy;
                p.x += p.vx;
                p.alpha = Math.max(0, p.alpha - p.decay);

                const style = p.color.replace(')', `, ${p.alpha})`).replace('rgba', 'rgba');
                drawStar(ctx, p.x, p.y, 5, p.size, p.size / 2, style);
                active = true;
            }
        });

        if (active) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    animate();
};

// Weather codes translation helpers
function getWeatherDetails(code) {
    if (code === 0) return { icon: "wb_sunny", color: "text-amber-500", text: "Nắng ráo" };
    if ([1, 2, 3].includes(code)) return { icon: "partly_cloudy_day", color: "text-sky-400", text: "Mây rải rác" };
    if ([45, 48].includes(code)) return { icon: "foggy", color: "text-neutral-400", text: "Sương mù" };
    if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return { icon: "rainy", color: "text-blue-500", text: "Có mưa rào" };
    if ([95, 96, 99].includes(code)) return { icon: "thunderstorm", color: "text-red-500", text: "Giông bão" };
    return { icon: "cloud", color: "text-neutral-500", text: "Nhiều mây" };
}

window.gardenWeatherLoaded = false;

window.loadGardenWeather = function () {
    const locationEl = document.getElementById('garden-weather-location');
    if (locationEl) locationEl.innerText = "Đang lấy vị trí GPS...";

    // Khôi phục vị trí đã lưu nếu có
    window.userLat = parseFloat(localStorage.getItem('user_lat')) || null;
    window.userLng = parseFloat(localStorage.getItem('user_lng')) || null;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                window.userLat = lat;
                window.userLng = lon;
                localStorage.setItem('user_lat', lat);
                localStorage.setItem('user_lng', lon);
                window.fetchWeatherForecast(lat, lon);
            },
            (error) => {
                console.warn("Geolocation error, fallback to Mekong Delta", error);
                window.fetchWeatherForecast(10.762622, 106.660172, "ĐBSCL (Mặc định)");
            }
        );
    } else {
        window.fetchWeatherForecast(10.762622, 106.660172, "ĐBSCL (Mặc định)");
    }
};

window.fetchWeatherForecast = async function (lat, lon, customLocationName) {
    const locationEl = document.getElementById('garden-weather-location');
    const weatherInfoEl = document.getElementById('garden-weather-info');
    const adviceEl = document.getElementById('garden-weather-advice');

    if (locationEl) {
        locationEl.innerText = customLocationName || `Tọa độ: ${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`;
    }

    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
        const data = await res.json();

        if (!data || !data.daily) {
            throw new Error("Invalid weather data response");
        }

        const daily = data.daily;
        let html = '';
        const dayLabels = ["Hôm nay", "Ngày mai", "Ngày kia"];

        for (let i = 0; i < 3; i++) {
            const code = daily.weathercode[i];
            const maxTemp = daily.temperature_2m_max[i];
            const minTemp = daily.temperature_2m_min[i];
            const w = getWeatherDetails(code);
            const label = dayLabels[i];

            const animClass = w.icon === 'wb_sunny' ? 'animate-spin' : '';
            const animStyle = w.icon === 'wb_sunny' ? 'style="animation-duration: 15s;"' : '';

            html += `
                <div class="bg-surface-container-lowest/80 p-3 rounded-2xl border border-outline-variant/20 text-center flex flex-col items-center hover:bg-white transition-all duration-300">
                    <span class="text-[9px] font-black text-on-surface-variant uppercase">${label}</span>
                    <span class="material-symbols-outlined ${w.color} text-2xl my-1 ${animClass}" ${animStyle}>${w.icon}</span>
                    <span class="text-xs font-bold text-on-surface">${Math.round(minTemp)}°-${Math.round(maxTemp)}°C</span>
                    <span class="text-[9px] text-on-surface-variant font-medium">${w.text}</span>
                </div>
            `;
        }

        if (weatherInfoEl) weatherInfoEl.innerHTML = html;

        const todayPrecip = daily.precipitation_sum[0] || 0;
        const tomorrowPrecip = daily.precipitation_sum[1] || 0;
        const todayMaxTemp = daily.temperature_2m_max[0] || 30;
        const todayMinTemp = daily.temperature_2m_min[0] || 25;

        let advice = '';
        let isExtremeWeather = false;
        let weatherAlertText = '';

        if (todayPrecip > 5 || tomorrowPrecip > 5) {
            const rainAmt = Math.max(todayPrecip, tomorrowPrecip);
            advice = `Dự báo ngày mai có mưa (${rainAmt.toFixed(1)}mm). AI khuyến nghị: Tự động lùi lịch tưới để bảo vệ rễ cây, tránh ngập úng rễ.`;

            isExtremeWeather = true;
            weatherAlertText = `Cảnh báo mưa lớn: Dự báo có lượng mưa đạt ${rainAmt.toFixed(1)}mm. Hãy khơi thông rãnh thoát nước ruộng vườn để tránh ngập úng rễ.`;

            // Mark weather alert to suspend water indicators
            window.suspendWateringNeeds = true;
        } else if (todayMaxTemp >= 35) {
            advice = `Nhiệt độ đỉnh điểm hôm nay cao (${todayMaxTemp.toFixed(0)}°C). Đất bốc hơi nhanh, hãy tưới đẫm vào sáng sớm hoặc chiều tối muộn.`;

            isExtremeWeather = true;
            weatherAlertText = `Cảnh báo nắng nóng: Nhiệt độ đỉnh điểm lên tới ${todayMaxTemp.toFixed(0)}°C. Hãy tưới đẫm nước cho cây vào lúc sáng sớm hoặc chiều mát.`;

            window.suspendWateringNeeds = false;
        } else if (todayMinTemp <= 15) {
            advice = `Nhiệt độ xuống thấp (${todayMinTemp.toFixed(0)}°C). Khuyến cáo nông dân phủ rơm rạ hoặc màng bọc giữ ấm cho cây non.`;

            isExtremeWeather = true;
            weatherAlertText = `Cảnh báo rét hại: Nhiệt độ giảm xuống ${todayMinTemp.toFixed(0)}°C. Vui lòng tiến hành ủ ấm gốc hoặc che phủ nylon cho vườn cây.`;

            window.suspendWateringNeeds = false;
        } else {
            advice = `Thời tiết lý tưởng (${Math.round(todayMinTemp)}°C - ${Math.round(todayMaxTemp)}°C). Duy trì lịch tưới tiêu tiêu chuẩn 1 lần vào chiều tối.`;
            window.suspendWateringNeeds = false;
        }

        if (adviceEl) adviceEl.innerText = advice;

        // Thiết lập cảnh báo thời tiết thực tế
        if (isExtremeWeather) {
            window.currentWeatherAlert = {
                id: 'weather-alert-realtime',
                user_id: currentUser ? currentUser.id : null,
                actor_id: 'system_weather',
                type: 'alert',
                comment_text: weatherAlertText,
                created_at: new Date().toISOString(),
                is_read: false,
                actor_profiles: {
                    full_name: "Trung tâm Cố vấn Thời tiết",
                    avatar_url: null
                }
            };
        } else {
            window.currentWeatherAlert = null;
        }

        // Recalculate stats and badging with weather status
        updateOverallStatsVisuals();

    } catch (err) {
        console.error("Fetch weather forecast error:", err);
        if (weatherInfoEl) {
            weatherInfoEl.innerHTML = `
                <div class="col-span-3 text-center py-4 text-xs text-error font-medium">
                    Không thể tải dữ liệu thời tiết.
                </div>
            `;
        }
    }
};

function updateOverallStatsVisuals() {
    const garden = getMyGarden();
    let waterCount = 0;
    let fertilizerCount = 0;
    let harvestCount = 0;

    garden.forEach(g => {
        // If weather recommends skipping, count as not needing water
        const actualNeedsWater = window.suspendWateringNeeds ? false : g.needsWater;
        if (actualNeedsWater) waterCount++;
        if (g.needsFertilizer) fertilizerCount++;
        if (g.progress >= 95) harvestCount++;
    });

    let totalHealthScore = 0;
    if (garden.length > 0) {
        garden.forEach(g => {
            let plantHealth = 100;
            const actualNeedsWater = window.suspendWateringNeeds ? false : g.needsWater;
            if (actualNeedsWater) plantHealth -= 40;
            if (g.needsFertilizer) plantHealth -= 30;
            totalHealthScore += plantHealth;
        });
        totalHealthScore = Math.round(totalHealthScore / garden.length);
    } else {
        totalHealthScore = 100;
    }

    const healthEl = document.getElementById('garden-health');
    const harvestEl = document.getElementById('garden-harvest');
    const waterEl = document.getElementById('garden-water');
    const fertilizerEl = document.getElementById('garden-fertilizer-count');
    const healthCircle = document.getElementById('garden-health-circle');

    if (healthEl) healthEl.innerText = garden.length > 0 ? `${totalHealthScore}%` : "--%";
    if (harvestEl) harvestEl.innerText = harvestCount;
    if (waterEl) waterEl.innerText = waterCount;
    if (fertilizerEl) fertilizerEl.innerText = fertilizerCount;

    if (healthCircle) {
        const circumference = 213.6;
        const offset = circumference - (totalHealthScore / 100) * circumference;
        healthCircle.style.strokeDashoffset = offset;
    }
}

function renderMyGarden() {
    const garden = getMyGarden();
    const list = document.getElementById('my-garden-list');

    const countEl = document.getElementById('garden-count');
    if (countEl) countEl.innerText = garden.length;

    updateOverallStatsVisuals();

    // Trigger weather loading once automatically
    if (!window.gardenWeatherLoaded) {
        window.gardenWeatherLoaded = true;
        setTimeout(() => {
            window.loadGardenWeather();
        }, 100);
    }

    if (!list) return;

    if (garden.length === 0) {
        list.innerHTML = `
            <div class="col-span-full bg-white rounded-[32px] p-8 border border-outline-variant/60 shadow-sm text-center flex flex-col items-center justify-center py-16 text-on-surface-variant gap-4">
                <div class="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center text-primary">
                    <span class="material-symbols-outlined text-4xl">spa</span>
                </div>
                <h3 class="font-headline-md text-headline-md font-bold text-on-surface">Khu vườn đang trống</h3>
                <p class="font-body-md text-body-md text-center max-w-sm">Hãy sử dụng Máy quét AI để nhận diện cây trồng, rồi bấm <strong>"Thêm vào Vườn"</strong> để theo dõi sự tiến hóa và tưới tiêu.</p>
                <button onclick="switchTab('page-ai-home')" class="bg-primary text-on-primary font-label-lg px-6 py-3 rounded-full flex items-center gap-2 hover:bg-primary-container transition-colors shadow-sm mt-2">
                    <span class="material-symbols-outlined">photo_camera</span>
                    Quét cây ngay
                </button>
            </div>
        `;
        return;
    }

    list.innerHTML = garden.map((item, i) => {
        const isReadyToHarvest = item.progress >= 95;
        const actualNeedsWater = window.suspendWateringNeeds ? false : item.needsWater;

        // Dynamic evolution image from Unsplash
        const imageUrl = getStageImage(item.name, item.progress);

        // Status Badge selection
        let badgeHtml = '';
        if (isReadyToHarvest) {
            badgeHtml = `<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider pulse-badge-harvest">Sẵn sàng hái 🧺</span>`;
        } else if (actualNeedsWater || item.needsFertilizer) {
            badgeHtml = `<span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider pulse-badge-fertilize">Cần chăm sóc ⚠️</span>`;
        } else {
            badgeHtml = `<span class="bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Phát triển tốt ✨</span>`;
        }

        return `
            <div class="bg-white rounded-[32px] p-5 border border-outline-variant/60 shadow-sm flex gap-5 group hover:border-primary/30 transition-all cursor-pointer relative overflow-hidden"
                 onclick="window.openCropDetails('${item.name}')">
                 
                <!-- Canvas animation overlay -->
                <canvas id="canvas-care-${i}" class="absolute inset-0 pointer-events-none rounded-[32px] w-full h-full z-10"></canvas>
                 
                <!-- Delete Button -->
                <button onclick="event.stopPropagation(); window.removeFromGarden(${i})" 
                        class="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container-low hover:bg-red-500/10 hover:text-red-600 text-on-surface-variant flex items-center justify-center transition-all border border-outline-variant/30 active:scale-90 z-20"
                        title="Xóa cây khỏi vườn">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>

                <div class="w-24 h-24 rounded-2xl overflow-hidden shadow-inner relative shrink-0 z-10">
                    <img src="${imageUrl}"
                         class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" 
                         onerror="this.src='https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=200';"
                         loading="lazy">
                </div>

                <div class="flex-1 flex flex-col justify-between overflow-hidden z-10">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            ${badgeHtml}
                        </div>
                        <h4 class="font-black text-on-surface text-lg truncate pr-6">${item.name}</h4>
                        <p id="plant-stage-text-${i}" class="text-xs text-on-surface-variant font-medium">Giai đoạn: ${item.stage || 'Phát triển'}</p>
                    </div>
                    
                    <div class="flex items-center gap-3 my-2">
                        <div class="flex-1 h-2 bg-surface-container-low rounded-full overflow-hidden">
                            <div id="plant-progress-fill-${i}" class="h-full bg-gradient-to-r from-green-500 to-primary rounded-full transition-all duration-500" style="width: ${item.progress}%"></div>
                        </div>
                        <span id="plant-progress-text-${i}" class="text-[10px] font-black text-on-surface-variant">${item.progress}%</span>
                    </div>

                    <div class="flex gap-2">
                        ${isReadyToHarvest ? `
                            <button onclick="event.stopPropagation(); window.harvestGardenPlant(${i})"
                                class="w-full py-2 bg-primary text-white text-[11px] font-black rounded-xl hover:bg-primary-container shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-transform z-20">
                                🧺 Thu hoạch ngay
                            </button>
                        ` : `
                            <button id="btn-water-${i}" onclick="event.stopPropagation(); window.waterGardenPlant(${i})"
                                class="flex-1 py-1.5 ${actualNeedsWater ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-500/10 text-blue-600'} text-[10px] font-black rounded-xl hover:opacity-90 active:scale-95 transition-all z-20">
                                💧 Tưới nước
                            </button>
                            <button id="btn-fertilize-${i}" onclick="event.stopPropagation(); window.fertilizeGardenPlant(${i})"
                                class="flex-1 py-1.5 ${item.needsFertilizer ? 'bg-orange-500 text-white shadow-sm' : 'bg-orange-500/10 text-orange-600'} text-[10px] font-black rounded-xl hover:opacity-90 active:scale-95 transition-all z-20">
                                💊 Bón phân
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.saveScannedCropToGarden = function () {
    if (!currentUser) {
        showToast("Vui lòng đăng nhập để lưu cây vào Khu Vườn!", "info");
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.style.display = 'flex';
        return;
    }
    if (!currentResult) {
        showToast("Bạn chưa quét cây nào để thêm!", "warning");
        return;
    }

    const details = currentResult.details || {};
    const plantName = details.vi || currentResult.prediction;

    const garden = getMyGarden();
    const exists = garden.some(g => g.name === plantName);
    if (exists) {
        showToast("Cây này đã có trong Khu Vườn của bạn rồi!", "info");
        return;
    }

    garden.push({
        name: plantName,
        sci: details.ten_khoa_hoc || "N/A",
        date: new Date().toLocaleDateString('vi-VN'),
        image_url: currentResult.image_url || "",
        needsWater: true,
        needsFertilizer: true,
        progress: 35,
        stage: "Cây non"
    });

    saveMyGarden(garden);
    renderMyGarden();

    showToast("Đã lưu cây trồng thành công vào Khu Vườn! 🌿", "success");
    switchTab('page-garden');
};

window.removeFromGarden = function (index) {
    const garden = getMyGarden();
    const plant = garden[index];
    if (!plant) return;

    if (confirm(`Bạn có chắc muốn xóa cây ${plant.name} khỏi Khu Vườn?`)) {
        garden.splice(index, 1);
        saveMyGarden(garden);
        renderMyGarden();
        showToast("Đã xóa cây trồng khỏi vườn.", "info");
    }
};

window.waterGardenPlant = function (index) {
    const garden = getMyGarden();
    const plant = garden[index];
    if (!plant) return;

    window.playWaterAnimation(index);

    plant.needsWater = false;
    plant.progress = Math.min(100, plant.progress + 15);

    if (plant.progress >= 95) plant.stage = "Thu hoạch";
    else if (plant.progress >= 70) plant.stage = "Ra trái/Hoa";
    else if (plant.progress >= 40) plant.stage = "Sinh trưởng";
    else plant.stage = "Cây non";

    saveMyGarden(garden);
    showToast(`Đã tưới nước cho ${plant.name}! 💧`, "success");

    // Smooth inline DOM updates
    const fill = document.getElementById(`plant-progress-fill-${index}`);
    if (fill) fill.style.width = `${plant.progress}%`;

    const txt = document.getElementById(`plant-progress-text-${index}`);
    if (txt) txt.innerText = `${plant.progress}%`;

    const stageTxt = document.getElementById(`plant-stage-text-${index}`);
    if (stageTxt) stageTxt.innerText = `Giai đoạn: ${plant.stage}`;

    const btn = document.getElementById(`btn-water-${index}`);
    if (btn) {
        btn.className = "flex-1 py-1.5 bg-blue-500/10 text-blue-600 text-[10px] font-black rounded-xl hover:opacity-90 active:scale-95 transition-all z-20";
    }

    updateOverallStatsVisuals();

    setTimeout(() => {
        renderMyGarden();
    }, 1500);
};

window.fertilizeGardenPlant = function (index) {
    const garden = getMyGarden();
    const plant = garden[index];
    if (!plant) return;

    window.playFertilizeAnimation(index);

    plant.needsFertilizer = false;
    plant.progress = Math.min(100, plant.progress + 20);

    if (plant.progress >= 95) plant.stage = "Thu hoạch";
    else if (plant.progress >= 70) plant.stage = "Ra trái/Hoa";
    else if (plant.progress >= 40) plant.stage = "Sinh trưởng";
    else plant.stage = "Cây non";

    saveMyGarden(garden);
    showToast(`Đã bón phân cho ${plant.name}! 💊`, "success");

    // Smooth inline DOM updates
    const fill = document.getElementById(`plant-progress-fill-${index}`);
    if (fill) fill.style.width = `${plant.progress}%`;

    const txt = document.getElementById(`plant-progress-text-${index}`);
    if (txt) txt.innerText = `${plant.progress}%`;

    const stageTxt = document.getElementById(`plant-stage-text-${index}`);
    if (stageTxt) stageTxt.innerText = `Giai đoạn: ${plant.stage}`;

    const btn = document.getElementById(`btn-fertilize-${index}`);
    if (btn) {
        btn.className = "flex-1 py-1.5 bg-orange-500/10 text-orange-600 text-[10px] font-black rounded-xl hover:opacity-90 active:scale-95 transition-all z-20";
    }

    updateOverallStatsVisuals();

    setTimeout(() => {
        renderMyGarden();
    }, 1500);
};

window.harvestGardenPlant = function (index) {
    const garden = getMyGarden();
    const plant = garden[index];
    if (!plant) return;

    showToast(`Chúc mừng bạn đã thu hoạch thành công ${plant.name}! 🧺`, "success");

    garden.splice(index, 1);
    saveMyGarden(garden);
    renderMyGarden();
};

function fetchHistory() {
    if (!currentUser) return;
    const userId = currentUser.id;
    fetch(`/api/history?user_id=${encodeURIComponent(userId)}`)
        .then(res => res.json())
        .then(data => {
            scanHistory = data || [];
            renderScanHistoryCards(scanHistory);
        })
        .catch(err => {
            console.error("Fetch history error:", err);
            scanHistory = [];
            renderScanHistoryCards([]);
        });
}

function renderScanHistoryCards(items) {
    const grid = document.getElementById('scan-history-grid');
    if (!grid) return;

    if (!items || items.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-on-surface-variant">
                <span class="material-symbols-outlined text-6xl text-outline-variant mb-4">photo_camera_back</span>
                <p class="font-headline-md text-headline-md font-bold text-on-surface mb-2">Chưa có lịch sử quét</p>
                <p class="font-body-md text-body-md text-center max-w-sm">Hãy sử dụng tính năng AI Nhận diện để quét cây trồng. Kết quả sẽ được lưu tại đây.</p>
                <button onclick="switchTab('page-ai-home')" class="mt-6 bg-primary text-on-primary font-label-lg px-6 py-3 rounded-full flex items-center gap-2 hover:bg-primary-container transition-colors shadow-sm">
                    <span class="material-symbols-outlined">smart_toy</span>
                    Quét ngay
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map(item => {
        const prob = parseFloat(item.probability || 0);
        const probPct = (prob * 100).toFixed(0);
        let statusBadge = `<span class="bg-primary text-on-primary font-label-md text-label-md px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <span class="material-symbols-outlined text-[16px]">check_circle</span>
            Đã nhận diện
        </span>`;
        let statusColor = 'border-l-4 border-l-primary';

        let imgSrc = item.image || '';
        // Fix local path if missing /history/ prefix
        if (imgSrc && !imgSrc.startsWith('http') && !imgSrc.startsWith('/history/') && !imgSrc.startsWith('data:')) {
            imgSrc = '/history/' + imgSrc;
        }
        if (!imgSrc) imgSrc = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';

        const hasImage = imgSrc.length > 30;
        const dateStr = item.date || '';
        const timeStr = item.time || '';

        return `
        <div class="bg-surface rounded-xl border border-outline-variant overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all ${statusColor} group">
            <div class="h-48 relative ${hasImage ? '' : 'bg-surface-container'}">
                ${hasImage
                ? `<img alt="${item.prediction}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="${imgSrc}" loading="lazy" />`
                : `<div class="absolute inset-0 flex items-center justify-center">
                        <span class="material-symbols-outlined text-4xl text-outline-variant">image_not_supported</span>
                    </div>`
            }
                <div class="absolute top-3 right-3">${statusBadge}</div>
                <button onclick="event.stopPropagation(); deleteScanItem('${item.id}')" class="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/80" title="Xóa">
                    <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>
            <div class="p-5 flex-grow flex flex-col">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-headline-md text-headline-md text-on-surface leading-tight">${item.prediction || 'Không xác định'}</h3>
                    <span class="text-on-surface-variant font-label-md text-label-md bg-surface-variant px-2 py-0.5 rounded whitespace-nowrap ml-2">${dateStr}</span>
                </div>
                <p class="font-body-md text-body-md text-on-surface-variant mb-4 flex-grow">
                    Kết quả nhận diện: ${item.prediction || 'N/A'}.
                    ${timeStr ? `<br><span class="text-xs text-outline">⏰ ${timeStr}</span>` : ''}
                </p>
                <button onclick="viewScanDetail('${item.id}')" class="w-full py-2.5 border border-outline-variant text-primary font-label-lg text-label-lg rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center gap-1.5">
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                    Xem chi tiết
                </button>
            </div>
        </div>
        `;
    }).join('');
}

window.filterScanHistory = function () {
    const searchVal = (document.getElementById('scan-history-search')?.value || '').toLowerCase();
    const dateFilter = document.getElementById('scan-history-date-filter')?.value || 'all';

    let filtered = [...scanHistory];

    // Search filter
    if (searchVal) {
        filtered = filtered.filter(item =>
            (item.prediction || '').toLowerCase().includes(searchVal)
        );
    }

    // Date filter
    if (dateFilter !== 'all') {
        const days = parseInt(dateFilter);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        filtered = filtered.filter(item => {
            if (!item.date) return true;
            try {
                const itemDate = new Date(item.date);
                return itemDate >= cutoff;
            } catch { return true; }
        });
    }

    renderScanHistoryCards(filtered);
};

window.clearScanHistory = async function () {
    if (!currentUser) return;
    showConfirmDialog({
        title: 'Xóa toàn bộ lịch sử quét?',
        message: 'Tất cả bản ghi quét AI sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.',
        icon: 'delete_forever',
        iconColor: 'bg-red-50 text-red-600',
        confirmText: 'Xóa tất cả',
        confirmColor: 'bg-red-600 hover:bg-red-700',
        onConfirm: async () => {
            try {
                const res = await fetch(`/api/history?user_id=${encodeURIComponent(currentUser.id)}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    scanHistory = [];
                    renderScanHistoryCards([]);
                    showToast('Đã xóa toàn bộ lịch sử quét!', 'success');
                }
            } catch (err) {
                showToast('Lỗi khi xóa lịch sử.', 'error');
            }
        }
    });
};

window.deleteScanItem = async function (scanId) {
    showConfirmDialog({
        title: 'Xóa bản ghi này?',
        message: 'Bản ghi quét này sẽ bị xóa khỏi lịch sử của bạn.',
        icon: 'delete',
        iconColor: 'bg-orange-50 text-orange-600',
        confirmText: 'Xóa',
        confirmColor: 'bg-red-600 hover:bg-red-700',
        onConfirm: async () => {
            try {
                const res = await fetch(`/api/history/${scanId}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    scanHistory = scanHistory.filter(i => i.id !== scanId);
                    renderScanHistoryCards(scanHistory);
                    showToast('Đã xóa bản ghi.', 'success');
                }
            } catch (err) {
                showToast('Lỗi khi xóa.', 'error');
            }
        }
    });
};

// =================== PREMIUM CONFIRM DIALOG ===================== //
window.showConfirmDialog = function ({ title, message, icon = 'warning', iconColor = 'bg-red-50 text-red-600', confirmText = 'Xác nhận', confirmColor = 'bg-red-600 hover:bg-red-700', cancelText = 'Hủy bỏ', onConfirm }) {
    // Xóa dialog cũ nếu có
    const old = document.getElementById('premium-confirm-dialog');
    if (old) old.remove();

    const dialog = document.createElement('div');
    dialog.id = 'premium-confirm-dialog';
    dialog.innerHTML = `
        <div class="fixed inset-0 z-[200] flex items-center justify-center p-4" style="animation: fadeIn 0.2s ease-out;">
            <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick="closeConfirmDialog()"></div>
            <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-[380px] overflow-hidden" style="animation: scaleIn 0.25s ease-out;">
                <div class="p-8 text-center">
                    <div class="w-16 h-16 ${iconColor} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                        <span class="material-symbols-outlined text-[32px]" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                    </div>
                    <h3 class="text-xl font-black text-neutral-800 mb-2">${title}</h3>
                    <p class="text-sm text-neutral-500 leading-relaxed">${message}</p>
                </div>
                <div class="flex gap-3 px-6 pb-6">
                    <button onclick="closeConfirmDialog()" class="flex-1 py-3 rounded-2xl text-sm font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-all active:scale-95">
                        ${cancelText}
                    </button>
                    <button id="confirm-dialog-yes" class="flex-1 py-3 rounded-2xl text-sm font-bold text-white ${confirmColor} transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">${icon}</span>
                        ${confirmText}
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('confirm-dialog-yes').addEventListener('click', () => {
        closeConfirmDialog();
        if (onConfirm) onConfirm();
    });
};

window.closeConfirmDialog = function () {
    const dialog = document.getElementById('premium-confirm-dialog');
    if (dialog) {
        dialog.querySelector('.relative').style.animation = 'scaleOut 0.15s ease-in forwards';
        setTimeout(() => dialog.remove(), 150);
    }
};

window.viewScanDetail = async function (scanId) {
    try {
        const res = await fetch(`/api/history/${scanId}`);
        if (!res.ok) {
            showToast('Không tìm thấy chi tiết bản ghi.', 'info');
            return;
        }
        const data = await res.json();
        if (data && data.prediction) {
            // Reuse the existing result display
            updateEncyclopedia({
                success: true,
                prediction: data.prediction,
                probability: data.probability,
                image_url: data.image_url,
                details: data.details || {}
            });
        }
    } catch (err) {
        showToast('Lỗi khi tải chi tiết.', 'error');
    }
};

// --- PLACEHOLDERS ---

// --- EXPERT MODAL ---
window.openAskExpertModal = function () {
    const modal = document.getElementById('ask-expert-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Nạp danh sách chuyên gia vào dropdown trong modal
        if (typeof populateExpertDropdown === 'function') populateExpertDropdown('ask-exp-target-expert-modal');

        // Reset modal fields
        const modalTitle = document.getElementById('exp-question-title-modal1');
        const modalContent = document.getElementById('exp-question-content-modal1');
        if (modalTitle) modalTitle.value = '';
        if (modalContent) modalContent.value = '';

        const fileInputModal = document.getElementById('ask-exp-images-modal');
        if (fileInputModal) fileInputModal.value = '';

        // Pre-populate if we have a scanned crop result
        const previewWrapper = document.getElementById('ask-exp-image-preview-modal-wrapper');
        if (previewWrapper) {
            // Remove existing dynamic previews (keep only the first child which is the add button)
            const addButton = previewWrapper.firstElementChild;
            previewWrapper.innerHTML = '';
            if (addButton) previewWrapper.appendChild(addButton);

            if (currentResult) {
                // Pre-populate title with crop name and diagnostic if any
                const details = currentResult.details || {};
                const cropName = details.vi || currentResult.prediction || '';

                let defaultTitle = `Hỏi về cây ${cropName}`;
                let defaultContent = `Tôi đã quét cây ${cropName} bằng AI. `;

                if (details.disease) {
                    const diseaseName = details.disease.disease_vi || '';
                    defaultTitle = `Cây ${cropName} nghi bị bệnh ${diseaseName}`;
                    defaultContent += `Hệ thống chẩn đoán bệnh: ${diseaseName} với mức độ nghiêm trọng: ${details.disease.severity || 'N/A'}. `;
                }

                if (modalTitle) modalTitle.value = defaultTitle;
                if (modalContent) modalContent.value = defaultContent + `Mong chuyên gia tư vấn giúp biện pháp xử lý.`;

                // Show scanned image preview
                if (currentResult.image_url) {
                    const div = document.createElement('div');
                    div.className = 'relative aspect-square rounded-2xl overflow-hidden border border-outline-variant shadow-sm';
                    div.innerHTML = `
                        <img src="${currentResult.image_url}" class="w-full h-full object-cover" />
                        <span class="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[8px] text-center rounded py-0.5 font-bold">Ảnh quét AI</span>
                    `;
                    previewWrapper.appendChild(div);
                }
            }
        }
    }
}

window.closeAskExpertModal = function () {
    const modal = document.getElementById('ask-expert-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Preview ảnh trong modal
window.previewExpertImagesModal = function (input) {
    var previewWrapper = document.getElementById('ask-exp-image-preview-modal-wrapper');
    if (!previewWrapper) return;

    // Clear previous previews but keep the first element (the add button)
    const addButton = previewWrapper.firstElementChild;
    previewWrapper.innerHTML = '';
    if (addButton) previewWrapper.appendChild(addButton);

    var files = Array.from(input.files).slice(0, 3);
    files.forEach(function (file) {
        if (!file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            var div = document.createElement('div');
            div.className = 'relative aspect-square rounded-2xl overflow-hidden border border-outline-variant shadow-sm';
            div.innerHTML = '<img src="' + e.target.result + '" class="w-full h-full object-cover" />';
            previewWrapper.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
};

// Chọn danh mục câu hỏi
window.selectExpertCategory = function (btn) {
    document.querySelectorAll('.ask-cat-btn').forEach(function (b) {
        b.classList.remove('bg-primary', 'text-on-primary', 'flex', 'items-center', 'gap-2');
        b.classList.add('bg-surface', 'border', 'border-outline-variant', 'text-on-surface-variant');
        var chk = b.querySelector('.cat-check');
        if (chk) chk.remove();
    });
    btn.classList.remove('bg-surface', 'border', 'border-outline-variant', 'text-on-surface-variant');
    btn.classList.add('bg-primary', 'text-on-primary', 'flex', 'items-center', 'gap-2');
    if (!btn.querySelector('.cat-check')) {
        var icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-[18px] cat-check';
        icon.textContent = 'check';
        btn.prepend(icon);
    }
};

// Preview ảnh đã chọn
window.previewExpertImages = function (input) {
    var preview = document.getElementById('ask-exp-image-preview');
    if (!preview) return;
    preview.innerHTML = '';
    var files = Array.from(input.files).slice(0, 5);
    files.forEach(function (file) {
        if (!file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            var div = document.createElement('div');
            div.className = 'relative w-20 h-20 rounded-xl overflow-hidden border border-outline-variant shadow-sm';
            div.innerHTML = '<img src="' + e.target.result + '" class="w-full h-full object-cover" />';
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
};

// Hiển thị lỗi inline ngay tại trường nhập
function _setFieldError(fieldId, message) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.add('border-red-500', 'ring-1', 'ring-red-500');
    el.classList.remove('border-outline-variant', 'focus:border-primary', 'focus:ring-primary');
    // Xóa thông báo cũ nếu có
    var old = document.getElementById(fieldId + '-error');
    if (old) old.remove();
    // Thêm thông báo lỗi mới
    var msg = document.createElement('p');
    msg.id = fieldId + '-error';
    msg.className = 'text-red-500 text-[12px] mt-1 flex items-center gap-1';
    msg.innerHTML = '<span class="material-symbols-outlined text-[14px]">error</span>' + message;
    el.parentNode.appendChild(msg);
    // Tự xóa lỗi khi người dùng bắt đầu nhập
    el.oninput = function () { _clearFieldError(fieldId); };
    el.focus();
}

function _clearFieldError(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
    el.classList.add('border-outline-variant', 'focus:border-primary', 'focus:ring-primary');
    var old = document.getElementById(fieldId + '-error');
    if (old) old.remove();
}

// Gửi câu hỏi chuyên gia
window.submitExpertQuestion = async function () {
    const modal = document.getElementById('ask-expert-modal');
    const isModalOpen = modal && modal.style.display === 'flex';

    let title = "";
    let content = "";
    let cropClass = "lua";
    let imageUrl = null;
    let submitBtn = null;
    let titleFieldId = "ask-exp-title";
    let contentFieldId = "ask-exp-content";
    let targetExpertId = null;

    if (isModalOpen) {
        titleFieldId = "exp-question-title-modal1";
        contentFieldId = "exp-question-content-modal1";
        title = (document.getElementById(titleFieldId)?.value || '').trim();
        content = (document.getElementById(contentFieldId)?.value || '').trim();

        const selectedRadio = document.querySelector('input[name="expert-category"]:checked');
        const categoryVal = selectedRadio ? selectedRadio.value : 'other';

        // Ánh xạ các chủ đề từ giao diện người dùng sang key database
        if (categoryVal === 'pests') cropClass = 'rau_mau';
        else if (categoryVal === 'soil') cropClass = 'phan_bon';
        else if (categoryVal === 'irrigation') cropClass = 'lua';
        else cropClass = 'cay_an_qua';

        submitBtn = document.getElementById('btn-submit-expert-modal');

        // Lấy chuyên gia được chọn từ modal
        const expertSelect = document.getElementById('ask-exp-target-expert-modal');
        if (expertSelect) targetExpertId = expertSelect.value || null;
    } else {
        title = (document.getElementById(titleFieldId)?.value || '').trim();
        content = (document.getElementById(contentFieldId)?.value || '').trim();

        // Lấy chủ đề từ nút đang được chọn trên trang
        const activeBtn = document.querySelector('.ask-cat-btn.bg-primary, .ask-cat-btn.active');
        if (activeBtn) {
            cropClass = activeBtn.dataset.cat || activeBtn.innerText.trim();
        }

        submitBtn = document.querySelector('#page-expert-ask button[type="submit"]');

        // Lấy chuyên gia được chọn từ trang hỏi đáp
        const expertSelect = document.getElementById('ask-exp-target-expert-page');
        if (expertSelect) targetExpertId = expertSelect.value || null;
    }

    // Reset lỗi cũ
    _clearFieldError(titleFieldId);
    _clearFieldError(contentFieldId);

    // Validate inline
    let hasError = false;
    if (!title) { _setFieldError(titleFieldId, 'Vui lòng nhập tiêu đề câu hỏi'); hasError = true; }
    if (!content) { _setFieldError(contentFieldId, 'Vui lòng mô tả chi tiết tình trạng'); hasError = true; }
    if (hasError) return;

    if (!currentUser) return showToast('Vui lòng đăng nhập để gửi câu hỏi!', 'warning');

    // Hiển thị loading
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">autorenew</span> Đang gửi...';
    }

    try {
        // Upload ảnh nếu có
        const fileInputId = isModalOpen ? 'ask-exp-images-modal' : 'ask-exp-images';
        const fileInput = document.getElementById(fileInputId);

        let imageUrl = null; // Khai báo rõ ràng để đảm bảo scope (hoặc ghi đè biến ngoài nếu có)

        if (fileInput && fileInput.files.length > 0 && window.supabaseClient) {
            const file = fileInput.files[0];
            const ext = file.name.split('.').pop();
            const fileName = 'expert_' + Date.now() + '.' + ext;
            const { data: uploadData, error: uploadErr } = await window.supabaseClient.storage
                .from('crop-images')
                .upload(fileName, file, { cacheControl: '3600', upsert: false });

            if (!uploadErr && uploadData) {
                const { data: urlData } = window.supabaseClient.storage.from('crop-images').getPublicUrl(fileName);
                imageUrl = urlData?.publicUrl || null;
            } else {
                console.warn("Lỗi upload ảnh Hỏi đáp (có thể do RLS), dùng fallback Base64:", uploadErr);
                // Fallback Base64 (bỏ qua giới hạn dung lượng)
                imageUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(file);
                });
            }
        } else if (isModalOpen && currentResult && currentResult.image_url) {
            // Default to scanned image if in modal and no upload
            imageUrl = currentResult.image_url;
        }

        // Gọi API backend để lưu yêu cầu chuyên gia thay vì gọi trực tiếp Supabase để tránh lỗi schema
        const response = await fetch('/api/expert-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                image_url: imageUrl || '',
                ai_prediction: currentResult ? currentResult.prediction : cropClass,
                ai_confidence: currentResult ? (currentResult.probability || 0.99) : 0.99,
                user_note: `Tiêu đề: ${title}\nNội dung: ${content}`,
                location: '',
                urgency: 'normal',
                target_expert_id: targetExpertId
            })
        });

        const respData = await response.json();
        if (!response.ok || !respData.success) {
            throw new Error(respData.error || 'Lỗi từ máy chủ backend');
        }

        showToast('Gửi câu hỏi thành công! 🚀', 'success');

        // Reset form
        document.getElementById(titleFieldId).value = '';
        document.getElementById(contentFieldId).value = '';
        if (fileInput) fileInput.value = '';

        if (isModalOpen) {
            const previewWrapper = document.getElementById('ask-exp-image-preview-modal-wrapper');
            if (previewWrapper) {
                const addButton = previewWrapper.firstElementChild;
                previewWrapper.innerHTML = '';
                if (addButton) previewWrapper.appendChild(addButton);
            }
            closeAskExpertModal();
        } else {
            const preview = document.getElementById('ask-exp-image-preview');
            if (preview) preview.innerHTML = '';
            // Reset category về mặc định
            const defaultBtn = document.querySelector('.ask-cat-btn[data-cat="lúa"]');
            if (defaultBtn) selectExpertCategory(defaultBtn);
        }

        // Tải lại dữ liệu Q&A tức thì
        if (typeof fetchExpertQnA === 'function') {
            await fetchExpertQnA(false);
        }

        // Quay lại feed
        switchTab('page-expert');

    } catch (err) {
        console.error('Lỗi gửi câu hỏi:', err);
        showToast('Lỗi khi gửi câu hỏi: ' + (err.message || 'Thử lại sau!'), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            if (isModalOpen) {
                submitBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">send</span> Gửi tới Chuyên gia';
            } else {
                submitBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">send</span> Gửi câu hỏi ngay';
            }
        }
    }
};

/**
 * [MỚI] Nạp danh sách chuyên gia từ cơ sở dữ liệu vào các thẻ Select
 */
window.populateExpertDropdown = function (selectId, selectedId = '') {
    const expertSelect = document.getElementById(selectId);
    if (expertSelect && window.supabaseClient) {
        // Giữ lại option mặc định ban đầu
        expertSelect.innerHTML = '<option value="">-- Gửi tới tất cả chuyên gia --</option>';

        return window.supabaseClient.from('profiles')
            .select('id, full_name')
            .eq('role', 'expert')
            .then(({ data, error }) => {
                if (error) {
                    console.error("Lỗi lấy danh sách chuyên gia:", error);
                    return;
                }
                if (data) {
                    // Xóa sạch trước khi append để tránh bị lặp dữ liệu do các cuộc gọi bất đồng bộ chạy song song
                    expertSelect.innerHTML = '<option value="">-- Gửi tới tất cả chuyên gia --</option>';
                    data.forEach(exp => {
                        const opt = document.createElement('option');
                        opt.value = exp.id;
                        opt.innerText = `Chuyên gia: ${exp.full_name}`;
                        expertSelect.appendChild(opt);
                    });
                    if (selectedId) {
                        expertSelect.value = selectedId;
                    }
                }
            })
            .catch(err => {
                console.error("Lỗi kết nối Supabase khi lấy chuyên gia:", err);
            });
    }
};

window.askSpecificExpert = function (expertId) {
    switchTab('page-expert-ask');
    window.populateExpertDropdown('ask-exp-target-expert-page', expertId);
};

// --- EXPLORE CONTENT LOADED AT TOP ---

window.openNewsArticle = async function (id) {
    let article = window.MOCK_NEWS ? window.MOCK_NEWS.find(a => a.id === id) : null;
    if (!article && window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('explore_news')
                .select('*')
                .eq('id', id)
                .single();
            if (!error && data) {
                article = data;
            }
        } catch (e) {
            console.error("Lỗi tải bài viết chi tiết", e);
        }
    }
    if (!article) return;

    const modal = document.getElementById('article-reader-modal');
    if (!modal) return;

    // Inject data
    document.getElementById('art-hero-img').src = article.image_url || 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1200&q=80';
    document.getElementById('art-badge').innerText = article.badge || 'TIÊU ĐIỂM';
    document.getElementById('art-title').innerText = article.title;
    document.getElementById('art-author-name').innerText = article.author || 'AgriSocial';
    document.getElementById('art-date').innerText = `${article.date || 'Hôm nay'} • 5 phút đọc`;
    document.getElementById('art-content').innerHTML = article.content || article.summary || '';

    // Tags
    const tagsEl = document.getElementById('art-tags');
    if (tagsEl) {
        const tags = Array.isArray(article.tags) ? article.tags : (article.tags ? article.tags.split(',').map(t => t.trim()) : []);
        tagsEl.innerHTML = tags.map(tag => `<span class="bg-surface-container-high px-3 py-1 rounded-full text-xs font-bold text-on-surface-variant">#${tag}</span>`).join('');
    }

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

window.closeNewsArticle = function () {
    const modal = document.getElementById('article-reader-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }
}

// --- CROP CALENDAR LOGIC ---
window.userTasks = []; // Chứa dữ liệu công việc thật từ DB
window.currentViewYear = 2026;
window.currentViewMonth = 4; // Tháng 5 (0-indexed)

window.changeMonth = function (delta) {
    window.currentViewMonth += delta;
    if (window.currentViewMonth > 11) {
        window.currentViewMonth = 0;
        window.currentViewYear++;
    } else if (window.currentViewMonth < 0) {
        window.currentViewMonth = 11;
        window.currentViewYear--;
    }
    renderCalendarGrid(window.currentViewYear, window.currentViewMonth);
}

window.renderCalendarGrid = function (year, month) {
    const gridBody = document.getElementById('calendar-grid-body');
    const headerTitle = document.getElementById('calendar-header-title');
    if (!gridBody) return;

    // Cập nhật tiêu đề
    if (headerTitle) headerTitle.innerText = `Tháng ${month + 1}, ${year}`;

    gridBody.innerHTML = '';

    // Ngày đầu tiên của tháng
    const firstDay = new Date(year, month, 1).getDay();
    // Số ngày trong tháng
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Các ô trống từ tháng trước
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay; i > 0; i--) {
        const d = prevMonthDays - i + 1;
        const div = document.createElement('div');
        div.className = 'bg-white h-24 p-2 text-xs text-outline opacity-30';
        div.innerText = d;
        gridBody.appendChild(div);
    }

    // Các ngày trong tháng hiện tại
    for (let d = 1; d <= daysInMonth; d++) {
        const div = document.createElement('div');
        div.id = `cal-day-${d}`;
        div.className = 'bg-white h-24 p-2 text-xs font-bold text-on-surface-variant cursor-pointer hover:bg-primary/5 transition-all flex flex-col items-center';
        div.onclick = () => selectCalendarDate(d);
        div.innerHTML = `<span>${d}</span>`;
        gridBody.appendChild(div);
    }

    // Highlight các chấm
    updateCalendarDots();
}

window.fetchUserTasks = async function () {
    const gridBody = document.getElementById('calendar-grid-body');
    if (gridBody && gridBody.innerHTML === '') {
        gridBody.innerHTML = '<div class="col-span-7 py-10 text-center animate-pulse">Đang tải lịch trình...</div>';
    }

    if (!currentUser) {
        console.log("DEBUG: Guest mode - rendering empty grid");
        window.userTasks = [];
        renderCalendarGrid(window.currentViewYear, window.currentViewMonth);
        return;
    }

    try {
        const res = await fetch(`/api/calendar/tasks?user_id=${currentUser.id}`);
        window.userTasks = await res.json();
        console.log("Loaded tasks:", window.userTasks);

        // Render lại lưới và chấm
        renderCalendarGrid(window.currentViewYear, window.currentViewMonth);
    } catch (err) {
        console.error("Lỗi tải công việc:", err);
        window.userTasks = [];
        renderCalendarGrid(window.currentViewYear, window.currentViewMonth);
    }
}

window.updateCalendarDots = function () {
    const gridBody = document.getElementById('calendar-grid-body');
    if (!gridBody) return;

    const dayElements = gridBody.querySelectorAll('div.cursor-pointer');
    dayElements.forEach(el => {
        const span = el.querySelector('span');
        if (!span) return;

        const dayNum = parseInt(span.innerText);

        // Tìm xem ngày này có việc không
        const hasTasks = window.userTasks.some(t => {
            const d = new Date(t.due_date);
            return d.getDate() === dayNum &&
                d.getMonth() === window.currentViewMonth &&
                d.getFullYear() === window.currentViewYear;
        });

        // Xóa chấm cũ
        const oldDot = el.querySelector('.task-dot');
        if (oldDot) oldDot.remove();

        if (hasTasks) {
            const dot = document.createElement('div');
            dot.className = 'task-dot w-2 h-2 bg-primary rounded-full mt-1 shadow-sm';
            el.appendChild(dot);
        }
    });
}

// --- WEATHER INTEGRATION ---
window.updateWeatherInfo = async function () {
    const weatherText = document.querySelector('#crop-calendar-modal p.text-on-surface-variant');
    const tempEl = document.querySelector('#crop-calendar-modal h3.text-2xl');
    const alertContainer = document.querySelector('#crop-calendar-modal .flex-1.space-y-3');

    try {
        const res = await fetch('/api/weather?lat=10.762622&lon=106.660172'); // Giả định tọa độ TP.HCM/ĐBSCL
        const data = await res.json();

        if (data.success) {
            const currentTemp = data.daily.temperature_2m_max[0];
            if (tempEl) tempEl.innerHTML = `${currentTemp}°C <span class="text-sm font-normal text-on-surface-variant">/ Cập nhật thực tế</span>`;

            if (data.alerts && data.alerts.length > 0) {
                const alert = data.alerts[0];
                if (alertContainer) {
                    alertContainer.innerHTML = `
                        <h4 class="text-xs font-black text-primary uppercase tracking-widest">Cảnh báo từ chuyên gia AI:</h4>
                        <div class="flex items-center gap-3 text-${alert.level === 'danger' ? 'red' : 'amber'}-600 font-bold text-sm bg-${alert.level === 'danger' ? 'red' : 'amber'}-50 p-3 rounded-2xl border border-${alert.level === 'danger' ? 'red' : 'amber'}-100 animate-pulse">
                            <span class="material-symbols-outlined text-[20px]">${alert.icon || 'warning'}</span>
                            ${alert.title}: ${alert.desc}
                        </div>
                    `;
                }
            }
        }
    } catch (err) {
        console.error("Lỗi cập nhật thời tiết:", err);
    }
}

// Gọi khi mở lịch
window.openFullCalendar = function () {
    const modal = document.getElementById('crop-calendar-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';

        // Mặc định xem tháng hiện tại nếu chưa có view
        if (window.currentViewYear === undefined) {
            const now = new Date();
            window.currentViewYear = now.getFullYear();
            window.currentViewMonth = now.getMonth();
        }

        fetchUserTasks();
        if (typeof updateWeatherInfo === 'function') {
            updateWeatherInfo();
        }
    }
}

window.closeFullCalendar = function () {
    const modal = document.getElementById('crop-calendar-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }
}

window.deleteTask = async function (taskId, day) {
    if (!confirm("Bạn có chắc chắn muốn xóa công việc này?")) return;
    try {
        const res = await fetch(`/api/calendar/tasks/${taskId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            // Cập nhật lại danh sách local
            window.userTasks = window.userTasks.filter(t => t.id !== taskId);
            // Render lại UI
            renderCalendarTasks(day);
            updateCalendarDots();
        }
    } catch (err) {
        console.error("Lỗi xóa công việc:", err);
    }
}

window.selectCalendarDate = function (day) {
    console.log("Selecting calendar date:", day);

    // UI: Highlight ô ngày được chọn
    const gridBody = document.getElementById('calendar-grid-body');
    if (gridBody) {
        gridBody.querySelectorAll('div').forEach(el => {
            el.classList.remove('ring-4', 'ring-primary/40', 'z-10');
        });
        const target = document.getElementById(`cal-day-${day}`);
        if (target) target.classList.add('ring-4', 'ring-primary/40', 'z-10');
    }

    renderCalendarTasks(day);
}

window.renderCalendarTasks = function (day) {
    const titleEl = document.getElementById('calendar-task-title');
    const container = document.getElementById('task-list-render-area');
    const badge = document.getElementById('task-count-badge');

    if (titleEl) titleEl.innerText = `Việc cần làm ngày ${day}/${window.currentViewMonth + 1}`;

    // Lọc công việc từ danh sách thật
    const dayTasks = window.userTasks.filter(t => {
        const d = new Date(t.due_date);
        return d.getDate() === day &&
            d.getMonth() === window.currentViewMonth &&
            d.getFullYear() === window.currentViewYear;
    });

    if (badge) badge.innerText = `${dayTasks.length} việc`;

    if (dayTasks.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 text-on-surface-variant text-sm italic">
                Không có công việc nào được lên lịch cho ngày này.
            </div>
        `;
        return;
    }

    container.innerHTML = dayTasks.map(task => `
        <div class="bg-surface rounded-2xl p-4 border border-outline-variant/60 flex items-center justify-between group hover:border-primary transition-all">
            <div class="flex items-center gap-4">
                <button onclick="toggleCalendarTask('${task.id}', ${day})" class="w-10 h-10 rounded-full border-2 ${task.is_completed ? 'bg-primary border-primary text-white' : 'border-outline text-transparent'} flex items-center justify-center hover:border-primary transition-all">
                    <span class="material-symbols-outlined text-[20px]">check</span>
                </button>
                <div>
                    <p class="font-bold text-on-surface ${task.is_completed ? 'line-through opacity-50' : ''}">${task.title}</p>
                    <p class="text-xs text-on-surface-variant">Hết hạn: ${task.due_date}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                ${task.is_important ? '<span class="bg-primary-container text-on-primary-container text-[10px] font-black px-2 py-1 rounded uppercase">Quan trọng</span>' : ''}
                <button onclick="deleteTask('${task.id}', ${day})" class="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

window.toggleCalendarTask = async function (taskId, currentDay) {
    const task = window.userTasks.find(t => t.id === taskId);
    if (task) {
        const newStatus = !task.is_completed;
        try {
            await fetch(`/api/calendar/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_completed: newStatus })
            });

            task.is_completed = newStatus;
            renderCalendarTasks(currentDay);

            if (newStatus) showToast("Đã hoàn thành công việc!", "success");
        } catch (err) {
            showToast("Lỗi khi cập nhật trạng thái!", "error");
        }
    }
}

// --- ADD CROP LOGIC ---
window.openAddCropModal = function () {
    document.getElementById('add-crop-modal').style.display = 'flex';
    document.getElementById('ac-date').value = new Date().toISOString().split('T')[0];
}

window.closeAddCropModal = function () {
    document.getElementById('add-crop-modal').style.display = 'none';
}

window.submitAddCrop = async function () {
    const crop_key = document.getElementById('ac-crop-key').value;
    const region = document.getElementById('ac-region').value;
    const planting_date = document.getElementById('ac-date').value;

    if (!planting_date) return alert("Vui lòng chọn ngày xuống giống!");

    showToast("Đang tạo lịch trình canh tác...", "info");

    try {
        const res = await fetch('/api/calendar/add-crop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                crop_key,
                region,
                planting_date
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast("Đã tạo lịch mùa vụ thành công! 🌱", "success");
            closeAddCropModal();
            fetchUserTasks().then(() => {
                // Tự động chuyển đến ngày xuống giống để thấy việc đầu tiên
                const d = new Date(planting_date);
                selectCalendarDate(d.getDate());
            });
        } else {
            alert("Lỗi: " + data.error);
        }
    } catch (err) {
        alert("Lỗi kết nối server!");
    }
}

// GOM CHUNG SỰ KIỆN KHỞI TẠO DOM VÀO 1 CHỖ DUY NHẤT
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Event listener cho nút share/post ở tab community
    const btnShare = document.getElementById('btn-share');
    if (btnShare) btnShare.onclick = () => { sharePost(currentResult ? currentResult.id : null); };

    const btnPost = document.getElementById('btn-post-community');
    if (btnPost) btnPost.onclick = openPostModal;
});
async function fetchTrendingCrops() {
    const listEl = document.getElementById('trending-crops-list');
    if (!listEl) return;
    try {
        const res = await fetch('/api/community/trending-crops');
        const data = await res.json();
        if (!data || data.length === 0) {
            listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Chưa có dữ liệu xu hướng</div>';
            return;
        }
        const cropEmojis = { 'Lúa': '🌾', 'Lúa gạo': '🌾', 'Ngô': '🌽', 'Bắp': '🌽', 'Cà phê': '☕', 'Đậu tương': '🌱', 'Khoai lang': '🍠', 'Khoai tây': '🥔', 'Khác': '🌿' };
        listEl.innerHTML = '';
        data.forEach((item, idx) => {
            item.icon = cropEmojis[item.name] || '🌿';
            listEl.innerHTML += AgrisocialComponents.renderTrendingItem(item, idx + 1);
        });
    } catch (err) {
        console.error("Lỗi tải xu hướng:", err);
    }
}

async function fetchSuggestedFriends() {
    const listEl = document.getElementById('suggested-friends-list');
    if (!listEl) return;
    try {
        let query = window.supabaseClient.from('profiles').select('*').limit(5);
        if (currentUser) query = query.neq('id', currentUser.id);
        const { data: users, error } = await query;

        if (error || !users || users.length === 0) {
            listEl.innerHTML = '<div style="text-align:center; padding:10px; color:#94a3b8; font-size:13px;">Chưa có gợi ý nào</div>';
            return;
        }

        listEl.innerHTML = '';
        users.forEach(user => {
            const displayName = user.full_name || 'Người dùng';
            const handle = user.username || 'user_' + String(user.id).substring(0, 5);
            const avatar = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00B14F&color=fff`;
            listEl.innerHTML += `
                <div class="cs-suggest-item" style="display:flex; align-items:center; gap:12px; margin-bottom: 12px;">
                    <img src="${avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; cursor:pointer;" onclick="viewUserProfile('${user.id}')">
                    <div style="flex:1;">
                        <div onclick="viewUserProfile('${user.id}')" style="font-size:14px; font-weight:700; color:#1e293b; cursor:pointer;">${displayName}</div>
                        <div style="font-size:11px; color:#64748b;">@${handle}</div>
                    </div>
                    <button style="padding:4px 10px; background:#f0fdf4; color:#059669; border:1px solid #86efac; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer;" onclick="handleFollow('${user.id}', this)">Theo dõi</button>
                </div>
            `;
        });
    } catch (err) {
        listEl.innerHTML = '<div style="text-align:center; color:#ef4444; font-size:12px;">Lỗi tải gợi ý</div>';
    }
}

window.handleFollow = async function (targetUserId, btn) {
    if (!currentUser) return showToast("Vui lòng đăng nhập để theo dõi!", "warning");
    btn.innerText = "Đang xử lý..."; btn.disabled = true;
    try {
        const { error } = await window.supabaseClient.from('follows').insert([{ follower_id: currentUser.id, following_id: targetUserId }]);
        if (error) throw error;
        btn.innerText = "Đang theo dõi"; btn.style.opacity = "0.6";
        showToast("Đã theo dõi!", "success");
    } catch (err) {
        btn.innerText = "Đang theo dõi"; btn.style.opacity = "0.6"; showToast("Đã theo dõi (Chế độ Demo)!", "success");
    }
};

// ================================================================ //
// =================== CÁC HÀM UI BỊ THIẾU ======================== //
// ================================================================ //

// Hàm bảo vệ dữ liệu ô nhập liệu (tránh mất chữ khi click ra ngoài)
function setupGlobalInputProtection() {
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            e.target.dataset.safeValue = e.target.value;
        }
    }, true);

    document.addEventListener('focusout', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            if (e.target.dataset.safeValue !== undefined && e.target.value === '') {
                e.target.value = e.target.dataset.safeValue;
            }
        }
    }, true);

    document.addEventListener('mousedown', (e) => {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            activeEl.dataset.safeValue = activeEl.value;
        }
    }, true);
}

// Hàm tìm kiếm trên thanh Header
function setupHeaderSearch() {
    return; // Đã chuyển sang window.AgriExplore.searchDropdown trong explore_components.js
    const searchInput = document.querySelector('.cs-search-bar input');
    const dropdown = document.getElementById('search-results-dropdown');
    if (searchInput && dropdown) {
        let timeout = null;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            searchInput.dataset.lastValue = query;
            clearTimeout(timeout);

            if (query.length < 1) {
                dropdown.innerHTML = '';
                dropdown.classList.add('hidden');
                return;
            }

            dropdown.innerHTML = `
                <div class="p-4 text-center text-xs text-on-surface-variant font-medium flex items-center justify-center gap-2">
                    <div class="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    Đang tìm kiếm...
                </div>
            `;
            dropdown.classList.remove('hidden');

            timeout = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/explore/search?q=${encodeURIComponent(query)}`);
                    const results = await res.json();

                    if (!results || results.length === 0) {
                        dropdown.innerHTML = `
                            <div class="p-4 text-center text-xs text-on-surface-variant font-medium">
                                <span class="material-symbols-outlined text-[20px] block opacity-40 mb-1">search_off</span>
                                Không tìm thấy kết quả cho "${query}"
                            </div>
                        `;
                        return;
                    }

                    // Group results
                    const crops = results.filter(r => r.type === 'crop');
                    const experts = results.filter(r => r.type === 'user' && r.subtitle === 'expert');
                    const news = results.filter(r => r.type === 'news');
                    const posts = results.filter(r => r.type === 'post');

                    let html = '';

                    if (crops.length > 0) {
                        html += `
                            <div class="p-2">
                                <h4 class="text-[10px] font-black text-primary uppercase tracking-widest px-3 py-1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">eco</span> Cây trồng (${crops.length})
                                </h4>
                                <div class="flex flex-col gap-1 mt-1">
                                    ${crops.map(c => `
                                        <div onclick="window.openCropDetails('${c.title}'); document.getElementById('search-results-dropdown').classList.add('hidden');" 
                                             class="flex items-center gap-3 p-2 rounded-2xl hover:bg-primary/5 cursor-pointer transition-all">
                                            <img src="${c.image_url}" class="w-10 h-10 rounded-xl object-cover border border-outline-variant/30 flex-shrink-0">
                                            <div class="overflow-hidden">
                                                <div class="text-xs font-black text-on-surface truncate">${c.title}</div>
                                                <div class="text-[10px] font-medium text-on-surface-variant truncate">${c.subtitle}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }

                    if (experts.length > 0) {
                        html += `
                            <div class="p-2 border-t border-outline-variant/30">
                                <h4 class="text-[10px] font-black text-secondary uppercase tracking-widest px-3 py-1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">support_agent</span> Chuyên gia (${experts.length})
                                </h4>
                                <div class="flex flex-col gap-1 mt-1">
                                    ${experts.map(e => `
                                        <div onclick="window.switchTab('page-expert'); document.getElementById('search-results-dropdown').classList.add('hidden');" 
                                             class="flex items-center gap-3 p-2 rounded-2xl hover:bg-secondary/5 cursor-pointer transition-all">
                                            <img src="${e.image_url}" class="w-10 h-10 rounded-full object-cover border border-outline-variant/30 flex-shrink-0">
                                            <div class="overflow-hidden">
                                                <div class="text-xs font-black text-on-surface truncate">${e.title}</div>
                                                <div class="text-[10px] font-medium text-on-surface-variant truncate">Chuyên gia kỹ thuật</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }

                    if (news.length > 0) {
                        html += `
                            <div class="p-2 border-t border-outline-variant/30">
                                <h4 class="text-[10px] font-black text-amber-600 uppercase tracking-widest px-3 py-1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">newspaper</span> Tin tức (${news.length})
                                </h4>
                                <div class="flex flex-col gap-1 mt-1">
                                    ${news.map(n => `
                                        <div onclick="window.openNewsArticle('${n.id}'); document.getElementById('search-results-dropdown').classList.add('hidden');" 
                                             class="flex items-center gap-3 p-2 rounded-2xl hover:bg-amber-50 cursor-pointer transition-all">
                                            <img src="${n.image_url}" class="w-10 h-10 rounded-xl object-cover border border-outline-variant/30 flex-shrink-0">
                                            <div class="overflow-hidden">
                                                <div class="text-xs font-black text-on-surface truncate">${n.title}</div>
                                                <div class="text-[10px] font-medium text-on-surface-variant truncate">${n.subtitle}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }

                    if (posts.length > 0) {
                        html += `
                            <div class="p-2 border-t border-outline-variant/30">
                                <h4 class="text-[10px] font-black text-rose-600 uppercase tracking-widest px-3 py-1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">article</span> Bài viết (${posts.length})
                                </h4>
                                <div class="flex flex-col gap-1 mt-1">
                                    ${posts.map(p => `
                                        <div onclick="window.switchTab('page-community'); document.getElementById('search-results-dropdown').classList.add('hidden');" 
                                             class="flex items-center gap-3 p-2 rounded-2xl hover:bg-rose-50 cursor-pointer transition-all">
                                            <img src="${p.image_url || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'}" class="w-10 h-10 rounded-xl object-cover border border-outline-variant/30 flex-shrink-0">
                                            <div class="overflow-hidden">
                                                <div class="text-xs font-black text-on-surface truncate">${p.title}</div>
                                                <div class="text-[10px] font-medium text-on-surface-variant truncate">Tác giả: ${p.subtitle}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }

                    dropdown.innerHTML = html;

                } catch (err) {
                    console.error("Lỗi tìm kiếm:", err);
                    dropdown.innerHTML = `
                        <div class="p-4 text-center text-xs text-on-surface-variant font-medium text-error">
                            Lỗi máy chủ tìm kiếm
                        </div>
                    `;
                }
            }, 300);
        });

        // Hide dropdown when clicking outside
        document.addEventListener('mousedown', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // Show dropdown again when search input gets focus and is not empty
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length > 0) {
                dropdown.classList.remove('hidden');
            }
        });
    }
}

// --- HÀM XỬ LÝ PREVIEW ẢNH TRONG MODAL CHỈNH SỬA ---
window.previewProfileImage = function (input, previewId) {
    console.log("Previewing image for:", previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const previewImg = document.getElementById(previewId);
            if (previewImg) {
                previewImg.src = e.target.result;
            }
            // Tự động gán vào input ẩn nếu có để lưu chuỗi base64
            const urlInputId = previewId === 'ep-avatar-preview' ? 'ep-avatar-url' : 'ep-cover-url';
            const urlInput = document.getElementById(urlInputId);
            if (urlInput) urlInput.value = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

const btnSaveEP = document.getElementById('btn-save-ep');
if (btnSaveEP) {
    btnSaveEP.onclick = async () => {
        if (!currentUser) return;

        const updatedData = {
            user_id: currentUser.id,
            full_name: document.getElementById('ep-name').value,
            bio: document.getElementById('ep-bio').value,
            avatar_url: document.getElementById('ep-avatar-preview').src, // Lấy ảnh mới từ preview
            cover_url: document.getElementById('ep-cover-preview').src,
            farm_location: document.getElementById('ep-farm-location').value,
            farm_area: parseFloat(document.getElementById('ep-farm-area').value) || 0,
            main_crop: document.getElementById('ep-main-crop').value,
            phone: document.getElementById('ep-phone').value
        };

        btnSaveEP.innerText = "Đang lưu...";
        btnSaveEP.disabled = true;

        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            const data = await res.json();

            if (data.success) {
                // 1. Cập nhật biến currentUser ngay lập tức để các hàm khác dùng dữ liệu mới
                window.currentUser = { ...window.currentUser, ...updatedData };

                // 2. Đồng bộ nhanh các vị trí avatar/tên trên Sidebar và Header mà không cần load lại trang
                updateAllUserUIElements(window.currentUser);

                // 3. Nếu đang ở trang cá nhân, vẽ lại toàn bộ Header trang cá nhân
                if (typeof renderProfilePage === 'function') {
                    renderProfilePage();
                }

                showToast("Cập nhật hồ sơ thành công!", "success");
                document.getElementById('edit-profile-modal').style.display = 'none';
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            showToast("Lỗi: " + err.message, "error");
        } finally {
            btnSaveEP.innerText = "Lưu thay đổi";
            btnSaveEP.disabled = false;
        }
    };
}

window.updateAllUserUIElements = function (userData) {
    if (!userData) return;

    const name = userData.full_name || userData.username || "Người dùng";
    let newAvatar = userData.avatar_url;

    // Tạo ảnh chữ cái màu xanh lá cây đậm chuẩn Material
    if (!newAvatar || newAvatar.trim() === '' || newAvatar === 'NULL') {
        newAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d631b&color=fff`;
    }

    // 1. Cập nhật TẤT CẢ avatar trên web (Topbar, Sidebar, Feed)
    const avatars = document.querySelectorAll('.user-avatar-img, #topbar-avatar, #sidebar-avatar, #feed-current-user-avatar');
    avatars.forEach(img => {
        img.src = newAvatar;
        img.style.display = 'block';
        // Ẩn các chữ cái mặc định đi
        if (img.nextElementSibling && (img.nextElementSibling.tagName === 'SPAN' || img.nextElementSibling.id.includes('placeholder'))) {
            img.nextElementSibling.style.display = 'none';
        }
    });

    // 2. Đồng bộ Tên
    const nameEls = document.querySelectorAll('.sp-name, #sidebar-name, #profile-name, .user-full-name');
    nameEls.forEach(el => { el.innerText = name; });

    // 3. Cập nhật riêng tên ở ô Đăng bài (Lấy chữ cuối của tên cho thân mật)
    const feedNameEl = document.getElementById('feed-current-user-name');
    if (feedNameEl) {
        feedNameEl.innerText = name.split(' ').pop();
    }

    // 4. Đồng bộ @Username
    const handleEls = document.querySelectorAll('.sp-handle, #sidebar-handle');
    const handle = userData.username || (userData.email ? userData.email.split('@')[0] : 'user');
    handleEls.forEach(el => { el.innerText = "@" + handle; });
};

// ================================================================ //
// =================== TƯƠNG TÁC (LIKE, COMMENT, SHARE) ============ //
// ================================================================ //

window.toggleLike = async function (btnElement, postId) {
    if (!currentUser) return showToast("Vui lòng đăng nhập!", "warning");

    const icon = btnElement.querySelector('.like-icon');
    const countEl = document.getElementById(`like-count-${postId}`);
    let currentCount = parseInt(countEl.innerText) || 0;

    // Kiểm tra trạng thái thực tế từ màu sắc nút
    const isCurrentlyLiked = icon.classList.contains('text-primary');

    // Hiệu ứng giao diện tức thì
    btnElement.style.transform = "scale(1.2)";
    setTimeout(() => btnElement.style.transform = "scale(1)", 150);

    try {
        if (!isCurrentlyLiked) {
            // --- THỰC HIỆN LIKE ---
            icon.style.fontVariationSettings = "'FILL' 1";
            icon.classList.add('text-primary');
            btnElement.classList.add('bg-primary/10', 'text-primary');
            countEl.innerText = currentCount + 1;

            const { error } = await window.supabaseClient.from('likes')
                .insert({ post_id: postId, user_id: currentUser.id });

            // Nếu lỗi 409 (đã like rồi) thì kệ nó, vẫn giữ giao diện xanh
            if (error && error.code !== '23505') throw error;
        } else {
            // --- THỰC HIỆN HỦY LIKE ---
            icon.style.fontVariationSettings = "'FILL' 0";
            icon.classList.remove('text-primary');
            btnElement.classList.remove('bg-primary/10', 'text-primary');
            countEl.innerText = currentCount > 0 ? currentCount - 1 : 0;

            const { error } = await window.supabaseClient.from('likes')
                .delete().eq('post_id', postId).eq('user_id', currentUser.id);
            if (error) throw error;
        }
    } catch (err) {
        console.error("Lỗi Like:", err);
        showToast("Không thể lưu trạng thái Like", "error");
        // Reload nhẹ bảng tin để đồng bộ lại nếu lỗi nặng
        fetchCommunityFeed();
    }
};
<<<<<<< HEAD
=======

window.openCommentModal = async function (postId) {
    const modal = document.getElementById('comment-modal');
    if (!modal) return;

    document.getElementById('cmt-modal-target-id').value = postId;
    document.getElementById('cmt-input-field').value = '';
    if (currentUser) document.getElementById('cmt-current-avatar').src = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.full_name}&background=0d631b&color=fff`;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const list = document.getElementById('cmt-modal-list');
    list.innerHTML = `<div class="text-center py-10 text-on-surface-variant"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-3"></div><br>Đang tải...</div>`;

    setTimeout(() => {
        // MOCK COMMENTS
        const mockComments = [
            {
                content: "Bài viết rất hữu ích, cảm ơn bạn đã chia sẻ!",
                created_at: new Date().toISOString(),
                profiles: { full_name: "Nguyễn Văn A", avatar_url: "https://i.pravatar.cc/150?u=a" }
            },
            {
                content: "Mình cũng đang gặp tình trạng tương tự ở vườn nhà mình.",
                created_at: new Date().toISOString(),
                profiles: { full_name: "Trần Thị B", avatar_url: "https://i.pravatar.cc/150?u=b" }
            }
        ];

        list.innerHTML = mockComments.map(cmt => {
            const ava = cmt.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${cmt.profiles?.full_name || 'U'}&background=0d631b&color=fff`;
            const name = cmt.profiles?.full_name || 'Người dùng';
            return `
                <div class="flex gap-3 mb-2 animate-fade-in-up">
                    <img src="${ava}" class="w-9 h-9 rounded-full object-cover">
                    <div class="bg-surface-container-low p-3 rounded-2xl rounded-tl-none border border-outline-variant/30">
                        <div class="font-bold text-[13px] text-on-surface">${name}</div>
                        <div class="text-[14px] text-on-surface-variant">${cmt.content}</div>
                    </div>
                </div>
            `;
        }).join('');
        list.scrollTop = list.scrollHeight;
    }, 500);
};

window.submitModalComment = async function () {
    if (!currentUser) return showToast("Vui lòng đăng nhập để bình luận!", "warning");

    const input = document.getElementById('cmt-input-field');
    const postId = document.getElementById('cmt-modal-target-id').value;
    const text = input.value.trim();
    if (!text || !postId) return;

    input.disabled = true;

    setTimeout(() => {
        // Cập nhật số đếm ở bài viết bên ngoài Bảng tin
        const countEl = document.getElementById(`comment-count-${postId}`);
        if (countEl) {
            const curCount = parseInt(countEl.innerText) || 0;
            countEl.innerText = `${curCount + 1} Bình luận`;
        }

        // Vẽ bình luận mới vừa đăng vào cuối danh sách Modal
        const list = document.getElementById('cmt-modal-list');
        const ava = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.full_name}&background=0d631b&color=fff`;
        const name = currentUser.full_name || 'Bạn';

        // Xóa thông báo "Hãy là người đầu tiên" nếu có
        if (list.innerHTML.includes('người đầu tiên')) list.innerHTML = '';

        list.insertAdjacentHTML('beforeend', `
            <div class="flex gap-3 mb-2 animate-fade-in-up">
                <img src="${ava}" class="w-9 h-9 rounded-full object-cover border border-primary/20">
                <div class="bg-primary/10 p-3 rounded-2xl rounded-tr-none">
                    <div class="font-bold text-[13px] text-primary">${name}</div>
                    <div class="text-[14px] text-on-surface">${text}</div>
                </div>
            </div>
        `);

        list.scrollTop = list.scrollHeight;
        input.value = '';
        showToast("Đã đăng bình luận!", "success");
        input.disabled = false;
        input.focus();
    }, 300);
};

>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
window.copyShareLink = function () {
    showToast("Đã sao chép liên kết bài viết!", "success");
};

window.shareResult = function () {
    const cropName = document.getElementById('c-name')?.innerText || 'này';
    if (navigator.share) {
        navigator.share({
            title: 'AgriSocial - Nhận diện cây trồng',
            text: `Tôi vừa nhận diện cây ${cropName} trên ứng dụng AgriSocial!`,
            url: window.location.href,
        }).catch(console.error);
    } else {
        showToast("Đã sao chép liên kết chia sẻ!", "success");
        navigator.clipboard.writeText(window.location.href).catch(() => { });
    }
};

// --- AGRICULTURE MAP LOGIC ---
let agriMap = null;
let loadedAgriData = []; // Bộ nhớ tạm để tìm kiếm nhanh

window.openAgricultureMap = async function () {
    const modal = document.getElementById('agri-map-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    setTimeout(async () => {
        if (!agriMap) {
            agriMap = L.map('leaflet-map').setView([10.5, 105.5], 8);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(agriMap);
        }

        agriMap.eachLayer((layer) => {
            if (layer instanceof L.GeoJSON || layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Polygon) {
                agriMap.removeLayer(layer);
            }
        });

        window.showToast("Đang tải dữ liệu thực tế từ OpenStreetMap...", "info");

        // --- NẠP DỮ LIỆU THỰC ĐỊA TOÀN DIỆN (REAL REFERENCE DATA - VIETNAM) ---
        // Hệ thống hóa toàn bộ các vựa lương thực trọng điểm theo yêu cầu
        const staticData = [
            // 1. LÚA (RICE) - 2 Đồng bằng lớn & Miền Trung
            { name: "Lúa - Vựa lúa An Giang (ĐBSCL)", lat: 10.37, lng: 105.43, type: "Lúa" },
            { name: "Lúa - Kiên Giang (ĐBSCL)", lat: 9.92, lng: 105.10, type: "Lúa" },
            { name: "Lúa - Đồng Tháp (ĐBSCL)", lat: 10.45, lng: 105.63, type: "Lúa" },
            { name: "Lúa - Long An (ĐBSCL)", lat: 10.53, lng: 106.41, type: "Lúa" },
            { name: "Lúa - Sóc Trăng (ĐBSCL)", lat: 9.60, lng: 105.97, type: "Lúa" },
            { name: "Lúa - Thái Bình (ĐBS Hồng)", lat: 20.45, lng: 106.33, type: "Lúa" },
            { name: "Lúa - Nam Định (ĐBS Hồng)", lat: 20.42, lng: 106.16, type: "Lúa" },
            { name: "Lúa - Hưng Yên (ĐBS Hồng)", lat: 20.65, lng: 106.05, type: "Lúa" },
            { name: "Lúa - Nghệ An (Miền Trung)", lat: 18.67, lng: 105.68, type: "Lúa" },
            { name: "Lúa - Thanh Hóa (Miền Trung)", lat: 19.81, lng: 105.77, type: "Lúa" },
            { name: "Lúa - Bình Định (Miền Trung)", lat: 13.78, lng: 109.22, type: "Lúa" },

            // 2. NGÔ (CORN/MAIZE) - Miền núi & Tây Nguyên
            { name: "Ngô - Vựa ngô Sơn La", lat: 21.32, lng: 103.92, type: "Ngô" },
            { name: "Ngô - Hà Giang", lat: 22.82, lng: 104.98, type: "Ngô" },
            { name: "Ngô - Điện Biên", lat: 21.38, lng: 103.01, type: "Ngô" },
            { name: "Ngô - Đắk Lắk (Tây Nguyên)", lat: 12.66, lng: 108.03, type: "Ngô" },
            { name: "Ngô - Đắk Nông (Tây Nguyên)", lat: 12.00, lng: 107.68, type: "Ngô" },
            { name: "Ngô - Đồng Nai", lat: 10.95, lng: 106.81, type: "Ngô" },
            { name: "Ngô - Bà Rịa - Vũng Tàu", lat: 10.45, lng: 107.16, type: "Ngô" },

            // 3. SẮN / KHOAI MÌ (CASSAVA) - Đông Nam Bộ & Tây Nguyên
            { name: "Sắn - Thủ phủ sắn Tây Ninh", lat: 11.36, lng: 106.12, type: "Sắn" },
            { name: "Sắn - Đồng Nai", lat: 11.00, lng: 107.15, type: "Sắn" },
            { name: "Sắn - Bình Phước", lat: 11.53, lng: 106.88, type: "Sắn" },
            { name: "Sắn - Gia Lai", lat: 13.98, lng: 108.00, type: "Sắn" },
            { name: "Sắn - Kon Tum", lat: 14.35, lng: 107.99, type: "Sắn" },

            // 4. MÍA (SUGARCANE)
            { name: "Mía - Vùng nguyên liệu Thanh Hóa", lat: 19.90, lng: 105.60, type: "Mía" },
            { name: "Mía - Nghệ An", lat: 19.00, lng: 105.40, type: "Mía" },
            { name: "Mía - Phú Yên", lat: 13.08, lng: 109.30, type: "Mía" },
            { name: "Mía - Khánh Hòa", lat: 12.24, lng: 109.19, type: "Mía" },
            { name: "Mía - Tây Ninh (Vựa mía lớn)", lat: 11.45, lng: 106.15, type: "Mía" },
            { name: "Mía - Hậu Giang (ĐBSCL)", lat: 9.78, lng: 105.47, type: "Mía" },
            { name: "Mía - Sóc Trăng", lat: 9.55, lng: 105.90, type: "Mía" },

            // 5. KHOAI LANG (SWEET POTATO)
            { name: "Khoai lang - Thủ phủ Bình Tân (Vĩnh Long)", lat: 10.15, lng: 105.85, type: "Khoai lang" },
            { name: "Khoai lang - Đồng Tháp", lat: 10.60, lng: 105.50, type: "Khoai lang" },
            { name: "Khoai lang - Đắk Nông", lat: 12.10, lng: 107.75, type: "Khoai lang" },
            { name: "Khoai lang - Lâm Đồng", lat: 11.80, lng: 108.30, type: "Khoai lang" },

            // 6. KHOAI TÂY (POTATO)
            { name: "Khoai tây - Vụ Đông Thái Bình", lat: 20.48, lng: 106.35, type: "Khoai tây" },
            { name: "Khoai tây - Hải Dương", lat: 20.93, lng: 106.31, type: "Khoai tây" },
            { name: "Khoai tây - Đà Lạt (Quanh năm)", lat: 11.94, lng: 108.44, type: "Khoai tây" },
            { name: "Khoai tây - Đơn Dương (Lâm Đồng)", lat: 11.85, lng: 108.58, type: "Khoai tây" },

            // 7. LÚA MÌ (WHEAT) & KHOAI (KHÁC)
            { name: "Lúa mì - Khảo nghiệm Sơn La", lat: 21.20, lng: 104.00, type: "Lúa mì" },
            { name: "Khoai (Yam/Taro) - Hòa Bình", lat: 20.81, lng: 105.33, type: "Khoai" }
        ];

        const cropColors = {
            "Lúa": "#22c55e", "Ngô": "#eab308", "Lúa mì": "#f97316", "Khoai": "#d97706",
            "Sắn": "#f87171", "Mía": "#059669", "Khoai lang": "#a855f7", "Khoai tây": "#a8a29e"
        };

        staticData.forEach(d => {
            const color = cropColors[d.type] || "#0d631b";
            const m = L.circleMarker([d.lat, d.lng], {
                radius: 11, fillColor: color, color: "#fff", weight: 3, opacity: 1, fillOpacity: 0.9
            }).addTo(agriMap).bindPopup(`
                <div class="p-2">
                    <b class="text-primary">${d.name}</b><br>
                    <span class="text-[10px]">Dữ liệu thực địa chuẩn hệ thống</span>
                </div>
            `);
            loadedAgriData.push({ name: d.name, lat: d.lat, lng: d.lng, marker: m });
        });

        loadedAgriData = [...loadedAgriData];
        console.log("Static Data Loaded:", loadedAgriData.length);

        const overpassUrl = 'https://overpass-api.de/api/interpreter';
        const overpassQuery = `
            [out:json][timeout:60];
            (
              way["landuse"="farmland"]["crop"~"rice|maize|corn|sugar|cassava|potato|sweet_potato|sugarcane"](8.5,102.0,23.5,109.5);
              node["landuse"="farmland"]["crop"~"rice|maize|corn|sugar|cassava|potato|sweet_potato|sugarcane"](8.5,102.0,23.5,109.5);
            );
            out center 150;
        `;

        try {
            const response = await fetch(overpassUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: "data=" + encodeURIComponent(overpassQuery)
            });

            if (!response.ok) throw new Error("OSM Server Busy");
            const data = await response.json();

            if (data.elements && data.elements.length > 0) {
                data.elements.forEach(el => {
                    if (el.tags && el.tags.crop) {
                        const cropTag = el.tags.crop.toLowerCase();
                        let vnName = "Cây lương thực";
                        let color = "#0d631b";

                        // Mapping
                        if (cropTag.includes('rice')) { vnName = "Lúa"; color = "#22c55e"; }
                        else if (cropTag.includes('corn') || cropTag.includes('maize')) { vnName = "Ngô"; color = "#eab308"; }
                        else if (cropTag.includes('sugar') || cropTag.includes('sugarcane')) { vnName = "Mía"; color = "#059669"; }
                        else if (cropTag.includes('cassava')) { vnName = "Sắn (Khoai mì)"; color = "#f87171"; }
                        else if (cropTag.includes('sweet_potato')) { vnName = "Khoai lang"; color = "#a855f7"; }
                        else if (cropTag.includes('potato')) { vnName = "Khoai tây"; color = "#a8a29e"; }
                        else if (cropTag.includes('wheat')) { vnName = "Lúa mì"; color = "#fcd34d"; }
                        else if (cropTag.includes('tuber') || cropTag.includes('yam') || cropTag.includes('taro')) { vnName = "Khoai (khác)"; color = "#d4d4d8"; }

                        const lat = el.lat || (el.center ? el.center.lat : null);
                        const lng = el.lon || (el.center ? el.center.lng : null);

                        if (lat && lng) {
                            const marker = L.circleMarker([lat, lng], {
                                radius: 9, fillColor: color, color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.8
                            }).addTo(agriMap).bindPopup(`
                                <div class="p-2">
                                    <div class="flex items-center gap-2 mb-1">
                                        <div style="background: ${color}" class="w-2 h-2 rounded-full"></div>
                                        <b class="text-primary text-sm">${vnName}</b>
                                    </div>
                                    <span class="text-[10px] text-on-surface-variant">Dữ liệu thực tế OSM</span>
                                </div>
                            `);
                            loadedAgriData.push({ name: vnName, lat, lng, marker });
                        }
                    }
                });
                window.showToast(`Đã nạp thành công ${loadedAgriData.length} điểm thực tế!`, "success");
            }
        } catch (error) {
            console.warn("OSM Service temporarily unavailable, using system data only.");
        }
        agriMap.invalidateSize();
    }, 400);
};

window.searchAgriMap = function (query) {
    const suggestions = document.getElementById('agri-map-suggestions');
    if (!suggestions) return;

    if (!query.trim()) {
        suggestions.classList.add('hidden');
        return;
    }

    // Hàm loại bỏ dấu tiếng Việt để tìm kiếm chính xác hơn
    const removeAccents = (str) => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    };

    const cleanQuery = removeAccents(query.toLowerCase());

    const filtered = loadedAgriData.filter(item => {
        const cleanName = removeAccents(item.name.toLowerCase());
        return cleanName.includes(cleanQuery);
    }).slice(0, 10);

    if (filtered.length > 0) {
        suggestions.classList.remove('hidden');
        suggestions.innerHTML = filtered.map(item => `
            <div class="px-4 py-3 hover:bg-surface-container transition-colors cursor-pointer border-b border-outline-variant/30 flex items-center justify-between"
                 onclick="window.goToAgriLocation(${item.lat}, ${item.lng}, '${item.name}', this)">
                <div>
                    <div class="font-black text-on-surface text-sm">${item.name}</div>
                    <div class="text-[10px] text-on-surface-variant">Tọa độ: ${item.lat.toFixed(3)}, ${item.lng.toFixed(3)}</div>
                </div>
                <span class="material-symbols-outlined text-primary text-sm">near_me</span>
            </div>
        `).join('');
    } else {
        suggestions.innerHTML = '<div class="p-4 text-xs text-on-surface-variant italic">Không tìm thấy địa điểm phù hợp</div>';
        suggestions.classList.remove('hidden');
    }
};

window.goToAgriLocation = function (lat, lng, name, el) {
    if (!agriMap) return;

    // Ẩn gợi ý
    document.getElementById('agri-map-suggestions').classList.add('hidden');
    document.getElementById('agri-map-search').value = name;

    // Hiệu ứng bay đến tọa độ
    agriMap.flyTo([lat, lng], 14, {
        animate: true,
        duration: 1.5
    });

    // Tìm marker tương ứng để mở popup
    const target = loadedAgriData.find(d => d.lat === lat && d.lng === lng);
    if (target && target.marker) {
        setTimeout(() => {
            target.marker.openPopup();
        }, 1600);
    }
};

window.closeAgricultureMap = function () {
    const modal = document.getElementById('agri-map-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';
};

// Handle outside clicks for notification popover
window.addEventListener('click', function (e) {
    const popover = document.getElementById('notifications-popover');
    const btn = document.getElementById('btn-notifications');
    if (popover && !popover.contains(e.target) && !btn.contains(e.target)) {
        popover.classList.add('opacity-0', 'invisible', 'translate-y-2');
    }
});

// =========================================================
// 💬 CHAT WIDGET CAO CẤP (PREMIUM FLOATING CHAT)
// =========================================================

window.openChat = function (userId, userName, userAvatar) {
    const container = document.getElementById('floating-chat-container');
    if (!container) return;

    // Đảm bảo container nhận tương tác (pointer-events-auto khi có con)
    container.classList.remove('pointer-events-none');

    // Kiểm tra xem chatbox với user này đã mở chưa
    const existingChat = document.getElementById(`chatbox-${userId}`);
    if (existingChat) {
        // Nếu đã mở thì kích hoạt lại (phóng to nếu đang thu nhỏ)
        const contentArea = document.getElementById(`chat-content-${userId}`);
        const inputArea = document.getElementById(`chat-input-area-${userId}`);
        if (contentArea && contentArea.classList.contains('hidden')) {
            contentArea.classList.remove('hidden');
            inputArea.classList.remove('hidden');
        }
        document.getElementById(`chat-input-${userId}`).focus();
        return;
    }

    // Tạo mã HTML cho khung chat mới
    const chatHtml = `
        <div id="chatbox-${userId}" class="pointer-events-auto w-[360px] max-w-[90vw] bg-white/95 backdrop-blur-xl border border-outline-variant/50 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden transition-all duration-300 transform translate-y-2 opacity-0">
            <!-- Header -->
            <div class="bg-primary/95 text-on-primary px-4 py-3 flex items-center justify-between cursor-pointer" onclick="toggleMinimizeChat('${userId}')">
                <div class="flex items-center gap-2.5">
                    <div class="relative">
                        <img src="${userAvatar}" class="w-9 h-9 rounded-full object-cover border border-white/20" alt="Avatar" />
                        <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-primary rounded-full animate-pulse"></span>
                    </div>
                    <div>
                        <h4 class="font-bold text-sm leading-tight">${userName}</h4>
                        <span class="text-[11px] text-white/80">Đang hoạt động</span>
                    </div>
                </div>
                <div class="flex items-center gap-1.5" onclick="event.stopPropagation();">
                    <button onclick="toggleMinimizeChat('${userId}')" class="hover:bg-white/10 p-1.5 rounded-lg transition-colors flex items-center justify-center">
                        <span class="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                    <button onclick="closeChat('${userId}')" class="hover:bg-white/10 p-1.5 rounded-lg transition-colors flex items-center justify-center">
                        <span class="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            </div>
            
            <!-- Message List -->
            <div id="chat-content-${userId}" class="h-80 overflow-y-auto p-4 flex flex-col gap-3 bg-surface-container-lowest/50">
                <div class="text-center text-[11px] text-on-surface-variant/60 my-2">Cuộc hội thoại bảo mật end-to-end</div>
                <div id="chat-messages-${userId}" class="flex flex-col gap-3">
                    <!-- Tin nhắn sẽ được nạp ở đây -->
                </div>
                <div id="typing-indicator-${userId}" class="hidden flex items-center gap-2 self-start bg-surface-container-low px-3 py-2 rounded-2xl rounded-tl-none border border-outline-variant/30">
                    <div class="w-1.5 h-1.5 bg-on-surface-variant/60 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                    <div class="w-1.5 h-1.5 bg-on-surface-variant/60 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                    <div class="w-1.5 h-1.5 bg-on-surface-variant/60 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
            </div>

            <!-- Input Area -->
            <div id="chat-input-area-${userId}" class="p-3 border-t border-outline-variant/40 flex items-center gap-2 bg-white">
                <button class="hover:bg-surface-container-low p-2 rounded-full transition-colors text-on-surface-variant/70">
                    <span class="material-symbols-outlined text-[20px]">image</span>
                </button>
                <input id="chat-input-${userId}" type="text" placeholder="Nhập tin nhắn..." class="flex-1 bg-surface-container-low text-on-surface border-0 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" onkeypress="handleChatKeyPress(event, '${userId}', '${userName.replace(/'/g, "\\'")}', '${userAvatar}')" />
                <button onclick="sendMessage('${userId}', '${userName.replace(/'/g, "\\'")}', '${userAvatar}')" class="bg-primary text-on-primary p-2 rounded-full hover:bg-primary/95 transition-all shadow-sm flex items-center justify-center">
                    <span class="material-symbols-outlined text-[18px]">send</span>
                </button>
            </div>
        </div>
    `;

    // Append to container
    container.insertAdjacentHTML('beforeend', chatHtml);

    // Kích hoạt animation
    setTimeout(() => {
        const box = document.getElementById(`chatbox-${userId}`);
        if (box) {
            box.classList.remove('opacity-0', 'translate-y-2');
        }
    }, 50);

    // Load tin nhắn cũ từ localStorage
    loadChatHistory(userId);
};

window.closeChat = function (userId) {
    const box = document.getElementById(`chatbox-${userId}`);
    if (box) {
        box.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => {
            box.remove();

            // Nếu không còn khung chat nào, đặt lại pointer-events-none cho container
            const container = document.getElementById('floating-chat-container');
            if (container && container.children.length === 0) {
                container.classList.add('pointer-events-none');
            }
        }, 300);
    }
};

window.toggleMinimizeChat = function (userId) {
    const content = document.getElementById(`chat-content-${userId}`);
    const input = document.getElementById(`chat-input-area-${userId}`);
    if (content && input) {
        content.classList.toggle('hidden');
        input.classList.toggle('hidden');
    }
};

window.loadChatHistory = function (userId) {
    const msgContainer = document.getElementById(`chat-messages-${userId}`);
    if (!msgContainer || !currentUser) return;

    const storageKey = `agrisocial_chat_${currentUser.id}_${userId}`;
    const history = JSON.parse(localStorage.getItem(storageKey)) || [];

    if (history.length === 0) {
        // Lời chào mở đầu mặc định từ Chuyên gia để tăng tính tương tác
        const defaultWelcome = {
            senderId: userId,
            text: `Xin chào! Tôi có thể giúp gì cho bạn về kỹ thuật canh tác, sâu bệnh hay chăm sóc cây trồng hôm nay?`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        history.push(defaultWelcome);
        localStorage.setItem(storageKey, JSON.stringify(history));
    }

    msgContainer.innerHTML = history.map(msg => {
        const isSelf = msg.senderId === currentUser.id;
        return `
            <div class="flex flex-col ${isSelf ? 'items-end' : 'items-start'} max-w-[85%] ${isSelf ? 'self-end' : 'self-start'}">
                <div class="${isSelf ? 'bg-primary text-on-primary rounded-[20px] rounded-tr-none' : 'bg-surface-container-low text-on-surface border border-outline-variant/30 rounded-[20px] rounded-tl-none'} px-3.5 py-2 text-sm leading-relaxed shadow-sm">
                    ${msg.text}
                </div>
                <span class="text-[9px] text-on-surface-variant/50 mt-1 px-1">${msg.time}</span>
            </div>
        `;
    }).join('');

    // Scroll to bottom
    const contentArea = document.getElementById(`chat-content-${userId}`);
    if (contentArea) contentArea.scrollTop = contentArea.scrollHeight;
};

window.handleChatKeyPress = function (e, userId, userName, userAvatar) {
    if (e.key === 'Enter') {
        sendMessage(userId, userName, userAvatar);
    }
};

window.sendMessage = function (userId, userName, userAvatar) {
    const input = document.getElementById(`chat-input-${userId}`);
    if (!input || !input.value.trim() || !currentUser) return;

    const text = input.value.trim();
    input.value = '';

    const storageKey = `agrisocial_chat_${currentUser.id}_${userId}`;
    const history = JSON.parse(localStorage.getItem(storageKey)) || [];

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
        senderId: currentUser.id,
        text: text,
        time: timeStr
    };

    history.push(newMsg);
    localStorage.setItem(storageKey, JSON.stringify(history));

    // Render lại tin nhắn
    loadChatHistory(userId);

    // Kích hoạt phản hồi tự động thông minh từ Chuyên gia/QTV sau 1.5s
    triggerAutoReply(userId, userName, userAvatar, text);
};

window.triggerAutoReply = function (userId, userName, userAvatar, userText) {
    const indicator = document.getElementById(`typing-indicator-${userId}`);
    if (indicator) indicator.classList.remove('hidden');

    const contentArea = document.getElementById(`chat-content-${userId}`);
    if (contentArea) contentArea.scrollTop = contentArea.scrollHeight;

    setTimeout(() => {
        if (indicator) indicator.classList.add('hidden');

        const storageKey = `agrisocial_chat_${currentUser.id}_${userId}`;
        const history = JSON.parse(localStorage.getItem(storageKey)) || [];

        // Trả lời thông minh dựa trên nội dung tin nhắn
        let replyText = `Cảm ơn bạn đã nhắn tin. Tôi đã ghi nhận câu hỏi của bạn và sẽ phản hồi chi tiết nhất trong thời gian sớm nhất! Chúc bạn vụ mùa bội thu.`;
        const lowText = userText.toLowerCase();

        if (lowText.includes('lúa') || lowText.includes('gạo')) {
            replyText = `Chào bạn, đối với cây lúa ở giai đoạn này, bạn cần đặc biệt chú ý giữ mực nước ruộng ổn định (khoảng 3-5cm) và kiểm tra mật độ rầy nâu thường xuyên nhé.`;
        } else if (lowText.includes('sâu') || lowText.includes('bệnh') || lowText.includes('héo') || lowText.includes('vàng lá')) {
            replyText = `Vấn đề sâu bệnh/vàng lá này khá phức tạp. Bạn hãy chụp cận cảnh lá cây bị bệnh rồi tải lên mục "AI Nhận diện" hoặc gửi ảnh qua đây để tôi phân tích chính xác nhất nhé!`;
        } else if (lowText.includes('chào') || lowText.includes('hi') || lowText.includes('hello')) {
            replyText = `Chào bạn! Rất vui được hỗ trợ bạn hôm nay. Bạn đang quan tâm đến kỹ thuật canh tác loại cây trồng nào thế?`;
        } else if (lowText.includes('phân') || lowText.includes('bón') || lowText.includes('dinh dưỡng')) {
            replyText = `Nguyên tắc bón phân là "4 đúng" (đúng loại, đúng liều lượng, đúng lúc, đúng cách). Hãy ưu tiên phân bón hữu cơ hoai mục để cải tạo đất bền vững nhé bạn.`;
        }

        const replyMsg = {
            senderId: userId,
            text: replyText,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };

        history.push(replyMsg);
        localStorage.setItem(storageKey, JSON.stringify(history));

        loadChatHistory(userId);
    }, 2000);
};

// =========================================================
// 👨‍🔬 ALL EXPERTS MODAL
// =========================================================
let _allExpertsData = [];

window.openAllExpertsModal = async function () {
    const modal = document.getElementById('all-experts-modal');
    if (!modal) return;

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    // Clear search
    const searchInput = document.getElementById('all-experts-search');
    if (searchInput) searchInput.value = '';

    // Show loading
    const grid = document.getElementById('all-experts-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="col-span-2 text-center py-12 text-on-surface-variant">
                <span class="material-symbols-outlined animate-spin text-primary text-4xl block mb-2">autorenew</span>
                Đang tải danh sách chuyên gia...
            </div>`;
    }

    // Close on backdrop click
    modal.onclick = function (e) {
        if (e.target === modal) window.closeAllExpertsModal();
    };

    // Close on Escape key
    modal._escHandler = function (e) {
        if (e.key === 'Escape') window.closeAllExpertsModal();
    };
    document.addEventListener('keydown', modal._escHandler);

    try {
        if (!window.supabaseClient) {
            if (grid) grid.innerHTML = `<div class="col-span-2 text-center py-12 text-on-surface-variant">Không thể kết nối dữ liệu.</div>`;
            return;
        }

<<<<<<< HEAD
        const resExp = await fetch('/api/experts/top');
        const expData = await resExp.json();
        const experts = expData.data || [];
=======
        const { data: experts, error } = await window.supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url, role, username')
            .eq('role', 'expert')
            .order('full_name', { ascending: true });

        if (error) throw error;
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4

        _allExpertsData = experts || [];
        _renderAllExperts(_allExpertsData);

    } catch (err) {
        console.error('Lỗi tải chuyên gia:', err);
        const errMsg = err?.message || JSON.stringify(err) || 'Lỗi không xác định';
        if (grid) grid.innerHTML = `
            <div class="col-span-2 text-center py-12 text-on-surface-variant">
                <span class="material-symbols-outlined text-5xl block mb-2" style="color:#c62828">error_outline</span>
                <p class="font-bold mb-1">Không thể tải danh sách chuyên gia.</p>
                <p class="text-xs opacity-60">${errMsg}</p>
            </div>`;
    }
};

function _renderAllExperts(experts) {
    const grid = document.getElementById('all-experts-grid');
    if (!grid) return;

    if (!experts || experts.length === 0) {
        grid.innerHTML = `
            <div class="col-span-2 text-center py-12 text-on-surface-variant">
                <span class="material-symbols-outlined text-5xl block mb-2 opacity-40">person_search</span>
                Không tìm thấy chuyên gia nào.
            </div>`;
        return;
    }

    grid.innerHTML = experts.map(function (exp) {
        var avatar = exp.avatar_url || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(exp.full_name || 'CG') + '&background=0d631b&color=fff');
        var safeName = (exp.full_name || '').split("'").join(' ');
        var displayName = exp.full_name || 'Chuyên gia';
        var username = exp.username || 'chuyengia';

        var card = '<div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-3 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group"';
        card += ' onclick="window.targetProfileId=\'' + exp.id + '\'; closeAllExpertsModal(); setTimeout(function(){ switchTab(\'page-profile\'); }, 150);">';

        // Avatar + Info row
        card += '<div class="flex items-center gap-3">';
        card += '<div class="relative shrink-0">';
        card += '<img src="' + avatar + '" alt="' + displayName + '" class="w-14 h-14 rounded-full object-cover border-2 border-surface shadow-sm group-hover:border-primary transition-colors" />';
        card += '<span class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>';
        card += '</div>';
        card += '<div class="flex-1 min-w-0">';
        card += '<div class="flex items-center gap-1 flex-wrap">';
        card += '<h3 class="font-label-lg text-label-lg text-on-background truncate">' + displayName + '</h3>';
        card += '<span class="material-symbols-outlined text-primary text-[16px]" style="font-variation-settings:\'FILL\' 1;">verified</span>';
        card += '</div>';
<<<<<<< HEAD
        card += '<p class="font-body-md text-body-md text-on-surface-variant truncate mb-1 hidden">@' + username + '</p>';
        
        if (exp.rating > 0) {
            card += '<div class="flex items-center gap-1 mb-1">';
            card += '<span class="font-label-md text-amber-500 font-bold">' + exp.rating.toFixed(1) + '</span>';
            card += '<div class="flex text-amber-400"><svg class="w-3.5 h-3.5 fill-amber-400 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>';
            card += '<span class="text-[11px] text-slate-500 font-medium ml-0.5">(' + (exp.rating_count || 0) + ')</span>';
            card += '</div>';
        } else {
            card += '<span class="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded inline-block mb-1">Chưa có đánh giá</span><br>';
        }

        card += '<span class="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-container text-on-primary-container">Chuyên gia</span>';
=======
        card += '<p class="font-body-md text-body-md text-on-surface-variant truncate">@' + username + '</p>';
        card += '<span class="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-container text-on-primary-container">Chuyên gia</span>';
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
        card += '</div></div>';

        // Specialty info
        card += '<div class="flex items-center gap-1.5 text-on-surface-variant text-[12px] border-t border-outline-variant/20 pt-2">';
        card += '<span class="material-symbols-outlined text-[14px] text-primary">eco</span>';
        card += '<span>Chuyên gia nông nghiệp</span>';
        card += '</div>';

        // Action buttons row
        card += '<div class="grid grid-cols-2 gap-2">';
        card += '<button onclick="event.stopPropagation(); askSpecificExpert(\'' + exp.id + '\'); closeAllExpertsModal();"';
        card += ' class="flex items-center justify-center gap-1.5 bg-secondary-container text-on-secondary-container text-[12px] font-bold px-3 py-2 rounded-xl hover:opacity-80 transition-opacity">';
        card += '<span class="material-symbols-outlined text-[16px]">contact_support</span> Tư vấn';
        card += '</button>';
        card += '<button onclick="event.stopPropagation(); openChat(\'' + exp.id + '\', \'' + safeName + '\', \'' + avatar + '\'); closeAllExpertsModal();"';
        card += ' class="flex items-center justify-center gap-1.5 bg-primary-container text-on-primary-container text-[12px] font-bold px-3 py-2 rounded-xl hover:opacity-80 transition-opacity">';
        card += '<span class="material-symbols-outlined text-[16px]">chat</span> Nhắn tin';
        card += '</button></div></div>';

        return card;
    }).join('');
}

window.filterAllExperts = function (query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
        _renderAllExperts(_allExpertsData);
        return;
    }
    const filtered = _allExpertsData.filter(exp =>
        (exp.full_name || '').toLowerCase().includes(q) ||
        (exp.username || '').toLowerCase().includes(q)
    );
    _renderAllExperts(filtered);
};

window.closeAllExpertsModal = function () {
    const modal = document.getElementById('all-experts-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
    if (modal._escHandler) {
        document.removeEventListener('keydown', modal._escHandler);
        modal._escHandler = null;
    }
};

// ================================================================ //
// =================== AI CHATBOT NÔNG NGHIỆP ==================== //
// ================================================================ //

var agroChatHistory = JSON.parse(localStorage.getItem('agro_chat_history') || '[]');
var agroChatBusy = false;

window.toggleAgroChatPanel = function () {
    const panel = document.getElementById('agro-chat-panel');
    const fab = document.getElementById('agro-chat-fab');
    if (!panel) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        panel.style.display = 'flex';
        panel.style.animation = 'scaleIn 0.25s ease-out';
        if (fab) fab.style.display = 'none';

        // Restore chat history
        if (agroChatHistory.length > 0) {
            const msgs = document.getElementById('agro-chat-messages');
            // Chỉ restore nếu chưa có tin nhắn user
            if (msgs && !msgs.querySelector('.chat-user-msg')) {
                agroChatHistory.forEach(msg => {
                    if (msg.role === 'user') {
                        appendChatBubble(msg.content, 'user', false);
                    } else {
                        appendChatBubble(msg.content, 'ai', false);
                    }
                });
                scrollChatToBottom();
            }
        }

        setTimeout(() => document.getElementById('agro-chat-input')?.focus(), 200);
    } else {
        panel.style.animation = 'scaleOut 0.15s ease-in forwards';
        setTimeout(() => {
            panel.classList.add('hidden');
            panel.style.display = 'none';
            if (fab) fab.style.display = 'flex';
        }, 150);
    }
};

window.sendAgroChatMessage = async function () {
    if (agroChatBusy) return;
    const input = document.getElementById('agro-chat-input');
    const message = input ? input.value.trim() : '';
    if (!message) return;

    input.value = '';
    agroChatBusy = true;

    const sendBtn = document.getElementById('agro-chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    // Hide quick chips
    const chips = document.getElementById('chat-quick-chips');
    if (chips) chips.style.display = 'none';

    // Add user message
    appendChatBubble(message, 'user');
    agroChatHistory.push({ role: 'user', content: message });

    // Show typing indicator
    showTypingIndicator();

    try {
        const payload = {
            message: message,
            conversation_history: JSON.stringify(agroChatHistory.slice(-8)),
            user_id: (currentUser && currentUser.id) ? currentUser.id : 'anonymous'
        };

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        removeTypingIndicator();

        if (data.success && data.reply) {
            appendChatBubble(data.reply, 'ai');
            agroChatHistory.push({ role: 'assistant', content: data.reply });

            // Show follow-up suggestions
            if (data.suggestions && data.suggestions.length > 0) {
                showChatSuggestions(data.suggestions);
            }

            // Update source indicator
            const statusEl = document.getElementById('chat-status-text');
            if (statusEl) {
                statusEl.innerText = data.source === 'gemini' ? 'Online — Gemini AI' : 'Offline — Knowledge Base';
            }
        } else {
            appendChatBubble(data.reply || 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại!', 'ai');
        }
    } catch (err) {
        removeTypingIndicator();
        appendChatBubble('❌ Không thể kết nối đến server. Kiểm tra kết nối mạng và thử lại.', 'ai');
    } finally {
        agroChatBusy = false;
        if (sendBtn) sendBtn.disabled = false;
        saveChatHistory();
        input.focus();
    }
};

function appendChatBubble(text, role, animate = true) {
    const msgs = document.getElementById('agro-chat-messages');
    if (!msgs) return;

    const wrapper = document.createElement('div');
    wrapper.style.animation = animate ? 'fadeInUp 0.3s ease-out' : 'none';

    if (role === 'user') {
        wrapper.className = 'flex justify-end chat-user-msg';
        wrapper.innerHTML = `
            <div class="bg-primary text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%] shadow-sm">
                <p class="text-[13px] leading-relaxed">${escapeHtml(text)}</p>
            </div>
        `;
    } else {
        const formattedText = formatAIResponse(text);
        wrapper.className = 'flex gap-2.5 items-start';
        wrapper.innerHTML = `
            <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span class="material-symbols-outlined text-primary text-[16px]" style="font-variation-settings: 'FILL' 1;">eco</span>
            </div>
            <div class="bg-white rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] shadow-sm border border-neutral-100">
                <div class="text-[13px] text-neutral-700 leading-relaxed ai-response-content">${formattedText}</div>
            </div>
        `;
    }

    msgs.appendChild(wrapper);
    scrollChatToBottom();
}

function formatAIResponse(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    html = html.replace(/^[•\-]\s+(.+)$/gm, '<li class="ml-3">$1</li>');
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="list-disc space-y-1 my-1">$&</ul>');
    // Numbered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-3">$1</li>');
    // Newlines
    html = html.replace(/\n/g, '<br>');
    // Emojis stay as-is
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTypingIndicator() {
    const msgs = document.getElementById('agro-chat-messages');
    if (!msgs) return;
    const indicator = document.createElement('div');
    indicator.id = 'chat-typing-indicator';
    indicator.className = 'flex gap-2.5 items-start';
    indicator.style.animation = 'fadeInUp 0.2s ease-out';
    indicator.innerHTML = `
        <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <span class="material-symbols-outlined text-primary text-[16px]" style="font-variation-settings: 'FILL' 1;">eco</span>
        </div>
        <div class="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-neutral-100 flex items-center gap-1.5">
            <span class="w-2 h-2 bg-neutral-300 rounded-full animate-bounce" style="animation-delay: 0ms;"></span>
            <span class="w-2 h-2 bg-neutral-300 rounded-full animate-bounce" style="animation-delay: 150ms;"></span>
            <span class="w-2 h-2 bg-neutral-300 rounded-full animate-bounce" style="animation-delay: 300ms;"></span>
        </div>
    `;
    msgs.appendChild(indicator);
    scrollChatToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();
}

function showChatSuggestions(suggestions) {
    const msgs = document.getElementById('agro-chat-messages');
    if (!msgs || !suggestions || suggestions.length === 0) return;

    // Remove old suggestions
    msgs.querySelectorAll('.chat-suggestions-row').forEach(el => el.remove());

    const row = document.createElement('div');
    row.className = 'chat-suggestions-row flex flex-wrap gap-2 px-1 mt-1';
    row.style.animation = 'fadeInUp 0.3s ease-out';
    suggestions.forEach(s => {
        const chip = document.createElement('button');
        chip.className = 'px-3 py-1.5 bg-primary/5 border border-primary/20 text-primary text-[11px] font-bold rounded-full hover:bg-primary/10 transition-all active:scale-95';
        chip.textContent = s;
        chip.onclick = function () { handleChatChip(this); };
        row.appendChild(chip);
    });
    msgs.appendChild(row);
    scrollChatToBottom();
}

window.handleChatChip = function (el) {
    const text = el.textContent.replace(/^[🌾🐛🥔🌽⚡💊🛡️]\s*/, '').trim();
    const input = document.getElementById('agro-chat-input');
    if (input) {
        input.value = text;
        sendAgroChatMessage();
    }
};

window.clearChatHistory = function () {
    showConfirmDialog({
        title: 'Xóa lịch sử chat?',
        message: 'Toàn bộ cuộc trò chuyện sẽ bị xóa.',
        icon: 'delete_sweep',
        iconColor: 'bg-orange-50 text-orange-600',
        confirmText: 'Xóa',
        confirmColor: 'bg-red-600 hover:bg-red-700',
        onConfirm: () => {
            agroChatHistory = [];
            localStorage.removeItem('agro_chat_history');
            const msgs = document.getElementById('agro-chat-messages');
            if (msgs) {
                msgs.innerHTML = `
                    <div class="flex gap-2.5 items-start">
                        <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            <span class="material-symbols-outlined text-primary text-[16px]" style="font-variation-settings: 'FILL' 1;">eco</span>
                        </div>
                        <div class="bg-white rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] shadow-sm border border-neutral-100">
                            <p class="text-[13px] text-neutral-700 leading-relaxed">
                                Xin chào! 🌿 Tôi là <strong>trợ lý AI nông nghiệp</strong> của AgriSocial. Hỏi tôi bất cứ điều gì về cây lương thực nhé!
                            </p>
                        </div>
                    </div>
                    <div id="chat-quick-chips" class="flex flex-wrap gap-2 px-1 mt-1">
                        <button onclick="handleChatChip(this)" class="chat-chip px-3 py-1.5 bg-primary/5 border border-primary/20 text-primary text-[12px] font-bold rounded-full hover:bg-primary/10 transition-all active:scale-95">🌾 Cách trồng lúa hiệu quả?</button>
                        <button onclick="handleChatChip(this)" class="chat-chip px-3 py-1.5 bg-primary/5 border border-primary/20 text-primary text-[12px] font-bold rounded-full hover:bg-primary/10 transition-all active:scale-95">🐛 Rầy nâu trị thế nào?</button>
                        <button onclick="handleChatChip(this)" class="chat-chip px-3 py-1.5 bg-primary/5 border border-primary/20 text-primary text-[12px] font-bold rounded-full hover:bg-primary/10 transition-all active:scale-95">🥔 Bệnh mốc sương khoai tây</button>
                        <button onclick="handleChatChip(this)" class="chat-chip px-3 py-1.5 bg-primary/5 border border-primary/20 text-primary text-[12px] font-bold rounded-full hover:bg-primary/10 transition-all active:scale-95">🌽 Sâu keo mùa thu trên ngô</button>
                    </div>
                `;
            }
            showToast('Đã xóa lịch sử chat!', 'success');
        }
    });
};

function saveChatHistory() {
    try {
        // Chỉ lưu 20 tin nhắn gần nhất
        const toSave = agroChatHistory.slice(-20);
        localStorage.setItem('agro_chat_history', JSON.stringify(toSave));
    } catch (e) { }
}

function scrollChatToBottom() {
    const msgs = document.getElementById('agro-chat-messages');
    if (msgs) {
        setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 50);
    }
}

// --- CROP CORRECTION FLOW ---
window.openCropCorrectionModal = function () {
    const modal = document.getElementById('crop-correction-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeCropCorrectionModal = function () {
    const modal = document.getElementById('crop-correction-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.selectCorrectCrop = async function (cropType) {
    if (!currentResult || !currentResult.id) {
        showToast("Không tìm thấy kết quả quét hiện tại để sửa.", "error");
        return;
    }

    // Đóng modal
    closeCropCorrectionModal();

    // Hiển thị toast đang xử lý
    const cropNames = {
        'rice': 'Cây Lúa',
        'corn': 'Cây Ngô (Bắp)',
        'sweet_potato': 'Cây Khoai Lang',
        'potato': 'Cây Khoai Tây',
        'wheat': 'Cây Lúa Mì',
        'sugarcane': 'Cây Mía',
        'cassava': 'Cây Sắn / Khoai Mì',
        'soybean': 'Cây Đậu Nành'
    };
    const cropName = cropNames[cropType] || 'Cây Trồng';
    showToast("Đang phân tích lại bệnh học cho " + cropName + "...", "info");

    const formData = new FormData();
    formData.append('scan_id', currentResult.id);
    formData.append('crop_hint', cropType);
    if (currentUser && currentUser.id) {
        formData.append('user_id', currentUser.id);
    }

    try {
        const response = await fetch('/reclassify', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            showToast("Đã cập nhật chẩn đoán cây trồng mới thành công!", "success");

            // Cập nhật giao diện bách khoa toàn thư
            updateEncyclopedia(data);

            // Tải lại lịch sử sau một khoảng trễ ngắn
            setTimeout(fetchHistory, 500);
        } else {
            showToast(data.error || "Không thể phân tích lại hình ảnh.", "error");
        }
    } catch (err) {
        console.error("Reclassify error:", err);
        showToast("Lỗi kết nối máy chủ phân tích.", "error");
    }
};


// ================================================================ //
// ==================== DIGITAL LIBRARY HUB LOGIC ================= //
// ================================================================ //

let currentLibraryFilter = 'all';
let readerFontSize = 14; // pixels
let activeReaderDocId = null;
let activeReaderChapterIdx = 0;

window.libraryDocuments = [
    {
        id: "cam-nang-lua-2024",
        title: "Cẩm nang canh tác Lúa nước 2024",
        category: "guide",
        size: "12.5 MB",
        desc: "Hướng dẫn kỹ thuật gieo sạ, quản lý nước và bón phân cân đối cho Lúa vụ Đông Xuân và Hè Thu.",
        cover: "https://vista.gov.vn/vn-uploads/news/2020_09/29-9-2020/2.jpg",
        chapters: [
            {
                title: "Chương 1: Giới thiệu & Chọn giống lúa",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Lựa chọn giống lúa phù hợp & Xử lý hạt giống</h3>
                    <p class="mb-4 text-slate-600">Chọn giống lúa là khâu quyết định ban đầu cho năng suất và chất lượng gạo thương phẩm. Tùy theo vùng canh tác và điều kiện thổ nhưỡng, nông dân cần lưu ý:</p>
                    <table class="w-full text-xs text-slate-600 border border-slate-200 rounded-xl overflow-hidden mb-4">
                        <thead class="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                                <th class="border border-slate-200 p-2 text-left">Nhóm giống</th>
                                <th class="border border-slate-200 p-2 text-left">Tên giống phổ biến</th>
                                <th class="border border-slate-200 p-2 text-left">Đặc tính sinh học</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Chất lượng cao</td>
                                <td class="border border-slate-200 p-2">ST24, ST25, OM18, Jasmine 85</td>
                                <td class="border border-slate-200 p-2">Thơm nhẹ, dẻo nhiều, hạt gạo thon dài, giá bán cao.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Chịu phèn mặn</td>
                                <td class="border border-slate-200 p-2">OM9577, OM2517, ĐS1</td>
                                <td class="border border-slate-200 p-2">Chịu mặn 2-4‰, thích hợp ven biển ĐBSCL.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Cao sản/Đại trà</td>
                                <td class="border border-slate-200 p-2">OM5451, IR50404, Ma Lâm 202</td>
                                <td class="border border-slate-200 p-2">Thời gian sinh trưởng ngắn (85-95 ngày), đẻ nhánh khỏe.</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">lightbulb</span> MẸO KHUYẾN NÔNG (Ngâm ủ hạt giống):
                        </p>
                        <p class="text-xs mt-1">Ngâm giống trong nước sạch từ 24 - 36 giờ (lúa thuần) hoặc 12 - 18 giờ (lúa lai). Xử lý giống bằng chế phẩm trừ nấm phòng bệnh lúa von, sau đó đem ủ kín 24-36 giờ cho nứt nanh đều trước khi gieo sạ.</p>
                    </div>`
            },
            {
                title: "Chương 2: Chuẩn bị đất & Gieo sạ",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Kỹ thuật chuẩn bị đất ruộng và gieo sạ</h3>
                    <p class="mb-4 text-slate-600">Mặt ruộng bằng phẳng là điều kiện cốt lõi để quản lý nước ruộng, diệt trừ cỏ dại và ốc bươu vàng hiệu quả:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Làm đất:</strong> Cày lật đất phơi ải ít nhất 14 ngày trước vụ gieo. Bừa trục kỹ làm đất nhuyễn phẳng mịn. Ứng dụng máy trục san phẳng định vị laser nếu có điều kiện để mặt ruộng không bị đọng nước cục bộ.</li>
                        <li><strong>Đánh rãnh thoát nước:</strong> Tạo các đường rãnh biên ruộng rộng 20-30cm và rãnh xương cá sâu 15-20cm chéo ruộng để thoát nước chủ động nhanh chóng khi mưa bão.</li>
                        <li><strong>Mật độ gieo sạ khuyến cáo:</strong> Áp dụng sạ thưa hàng bằng máy sạ hàng hoặc máy sạ cụm với lượng giống 80 - 100 kg/ha. Sạ lan tay thông thường cần khống chế ở mức 100 - 120 kg/ha.</li>
                    </ul>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> CẢNH BÁO:
                        </p>
                        <p class="text-xs mt-1">Tránh gieo sạ quá dày (>150 kg/ha). Sạ quá dày khiến ruộng lúa rậm rạp, ẩm độ cao, tạo điều kiện thuận lợi cho bệnh đạo ôn lá phát triển và rầy nâu bùng phát ở giai đoạn làm đòng.</p>
                    </div>`
            },
            {
                title: "Chương 3: Bón phân cân đối NPK",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Quy trình bón phân 'Nặng đầu nhẹ đuôi'</h3>
                    <p class="mb-4 text-slate-600">Bón phân khoa học giúp lúa đẻ nhánh tập trung, đòng to khỏe và hạn chế đổ ngã cuối vụ. Dưới đây là công thức bón NPK tiêu chuẩn cho 1 ha lúa nước:</p>
                    <table class="w-full text-xs text-slate-600 border border-slate-200 rounded-xl overflow-hidden mb-4">
                        <thead class="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                                <th class="border border-slate-200 p-2 text-left">Giai đoạn</th>
                                <th class="border border-slate-200 p-2 text-left">Lượng bón (ha)</th>
                                <th class="border border-slate-200 p-2 text-left">Vai trò nông học</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Bón lót (Trước sạ)</td>
                                <td class="border border-slate-200 p-2">300-400kg Lân + 500kg Phân hữu cơ</td>
                                <td class="border border-slate-200 p-2">Kích thích rễ phát triển sâu, khử phèn.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Thúc đợt 1 (7-10 ngày sau sạ)</td>
                                <td class="border border-slate-200 p-2">50kg Ure + 100kg Super Lân + 30kg Kali clorua</td>
                                <td class="border border-slate-200 p-2">Giúp lúa nhanh bén rễ, hồi xanh nảy chồi sớm.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Thúc đợt 2 (18-22 ngày sau sạ)</td>
                                <td class="border border-slate-200 p-2">60kg Ure + 30kg Kali clorua</td>
                                <td class="border border-slate-200 p-2">Đẩy mạnh đẻ nhánh hữu hiệu, tạo chồi đồng loạt.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Thúc đợt 3 (40-45 ngày: Đón đòng)</td>
                                <td class="border border-slate-200 p-2">30kg Ure + 50kg Kali clorua</td>
                                <td class="border border-slate-200 p-2">Kích thích phân hóa đòng, nuôi bông lúa to hạt.</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="p-4 bg-blue-50 border border-blue-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-blue-700 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">info</span> LƯU Ý KỸ THUẬT:
                        </p>
                        <p class="text-xs mt-1">Khi bón đợt 3 (đón đòng), nông dân cần áp dụng kỹ thuật so màu lá bằng bảng màu LCC để điều chỉnh tăng/giảm lượng Ure phù hợp, tránh dư đạm gây lúa lép và đổ ngã.</p>
                    </div>`
            },
            {
                title: "Chương 4: Quản lý nước thông minh (AWD)",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Kỹ thuật 'Ướt khô xen kẽ' (AWD) tiết kiệm nước</h3>
                    <p class="mb-4 text-slate-600">Áp dụng chế độ tưới nước chủ động AWD giúp tiết kiệm 20-30% lượng nước tưới, giảm phát thải khí nhà kính (Methane) và nâng cao độ cứng cây lúa:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>0 - 7 ngày đầu:</strong> Giữ mặt ruộng ẩm ráo để hạt giống nhanh mọc mầm, tránh ngập lụt cục bộ thối hạt giống.</li>
                        <li><strong>7 - 30 ngày (Đẻ nhánh):</strong> Bơm nước ngập nông 3-5cm để ém hạt cỏ dại. Sau đó để nước tự cạn dần xuống dưới mặt ruộng khoảng 15cm (đo bằng ống nhựa PVC đục lỗ cắm sâu trên ruộng) rồi mới tiến hành bơm nước ngập lại 5cm.</li>
                        <li><strong>Giai đoạn Đón đòng & Trỗ bông:</strong> Duy trì mực nước ngập ổn định từ 3-5cm liên tục để bông trỗ đều, tránh thiếu hụt nước gây lọt đòng.</li>
                        <li><strong>10-12 ngày trước thu hoạch:</strong> Tháo cạn nước hoàn toàn để mặt ruộng khô ráo, giúp cứng cây dễ vận hành máy gặt đập liên hợp.</li>
                    </ul>`
            },
            {
                title: "Chương 5: Phòng trừ sâu bệnh hại tổng hợp IPM",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Quản lý dịch hại an toàn sinh học</h3>
                    <p class="mb-4 text-slate-600">Ưu tiên các biện pháp sinh học, cơ giới trước khi sử dụng hóa chất bảo vệ thực vật:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Ốc bươu vàng:</strong> Thả vịt vào ruộng ăn ốc non khi chuẩn bị đất, hoặc cắm các thanh tre xung quanh ruộng dụ ốc đẻ trứng rồi tiêu hủy thủ công.</li>
                        <li><strong>Bệnh đạo ôn lá (Cháy lá):</strong> Thường phát triển mạnh khi thời tiết ẩm mát, có sương mù ban đêm. Phun ngay thuốc chứa hoạt chất Tricyclazole hoặc Fenoxanil khi chớm thấy vết bệnh mắt én đầu tiên, dừng ngay việc bón đạm.</li>
                        <li><strong>Rầy nâu:</strong> Phun nấm đối kháng Metarhizium anisopliae từ đầu vụ. Chỉ phun thuốc hóa học đặc trị khi mật độ rầy đạt ngưỡng trên 3 con/tép lúa.</li>
                    </ul>`
            }
        ]
    },
    {
        id: "cam-nang-ngo-lai",
        title: "Kỹ thuật trồng Ngô lai năng suất cao",
        category: "guide",
        size: "8.4 MB",
        desc: "Quy trình chăm sóc Ngô lai chịu hạn, phòng trừ sâu keo mùa thu và tối ưu hóa mật độ gieo trồng.",
        cover: "https://rutoms.com/wp-content/uploads/2026/01/Growing-Corn.webp",
        chapters: [
            {
                title: "Chương 1: Chọn giống & Kỹ thuật gieo trồng",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Lựa chọn giống ngô & Mật độ gieo trồng tiêu chuẩn</h3>
                    <p class="mb-4 text-slate-600">Đảm bảo mật độ cây ngô hợp lý giúp tối đa hóa khả năng nhận ánh sáng và dinh dưỡng:</p>
                    <table class="w-full text-xs text-slate-600 border border-slate-200 rounded-xl overflow-hidden mb-4">
                        <thead class="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                                <th class="border border-slate-200 p-2 text-left">Phương pháp trồng</th>
                                <th class="border border-slate-200 p-2 text-left">Khoảng cách trồng</th>
                                <th class="border border-slate-200 p-2 text-left">Mật độ cây/ha</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Trồng hàng đơn</td>
                                <td class="border border-slate-200 p-2">70cm x 25cm (1 hạt/hốc)</td>
                                <td class="border border-slate-200 p-2">57.000 - 60.000 cây</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Trồng hàng kép (đất bằng)</td>
                                <td class="border border-slate-200 p-2">Hàng rộng 80cm, hàng hẹp 50cm x cây cách cây 30cm</td>
                                <td class="border border-slate-200 p-2">60.000 - 65.000 cây</td>
                            </tr>
                        </tbody>
                    </table>
                    <p class="mb-4 text-slate-600"><strong>Chuẩn bị giống:</strong> Lựa chọn các giống ngô lai F1 kháng sâu chịu hạn tốt như NK66, NK7328, CP511. Sử dụng hạt giống đã được nhà sản xuất xử lý sẵn thuốc bảo vệ thực vật phủ màng bảo vệ màu đỏ hoặc hồng để tránh nấm mốc và côn trùng đất phá hoại rễ mầm.</p>
                    <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">lightbulb</span> MẸO KHUYẾN NÔNG:
                        </p>
                        <p class="text-xs mt-1">Độ sâu gieo hạt lý tưởng từ 3 - 5 cm. Nếu gieo trong mùa khô hanh, nên tăng độ sâu lên 5 - 6 cm và nén nhẹ lớp đất mặt để giữ độ ẩm giúp hạt nhanh nảy mầm.</p>
                    </div>`
            },
            {
                title: "Chương 2: Phác đồ dinh dưỡng & Chăm sóc",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Quy trình bón phân cho Ngô lai F1</h3>
                    <p class="mb-4 text-slate-600">Ngô lai cần lượng dinh dưỡng đầy đủ và cân đối để bắp to, hạt chắc mẩy sát cùi:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Bón lót (Trước gieo):</strong> Bón toàn bộ lượng phân hữu cơ vi sinh (500kg/ha) kết hợp với 350-400kg phân lân Super lân và rải vôi bột (500kg/ha) để nâng pH đất lên mức 6.0-6.8.</li>
                        <li><strong>Bón thúc đợt 1 (Cây đạt 3-4 lá):</strong> Bón thúc 70-80kg Ure kết hợp 40kg Kali clorua. Xới xáo phá váng và vun nhẹ đất vào gốc lấp phân.</li>
                        <li><strong>Bón thúc đợt 2 (Cây đạt 7-9 lá):</strong> Bón thúc 100kg Ure + 60kg Kali clorua. Vun luống cao để kích thích ra rễ phụ chống đổ ngã.</li>
                        <li><strong>Bón thúc đợt 3 (Giai đoạn ngô xoắn loa kèn - trổ cờ):</strong> Bón nốt lượng đạm kali còn lại giúp cờ to khỏe và thụ phấn đều.</li>
                    </ul>`
            },
            {
                title: "Chương 3: Phòng trừ sâu keo mùa thu & Bệnh hại",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Đối phó sâu keo mùa thu (Spodoptera frugiperda)</h3>
                    <p class="mb-4 text-slate-600">Sâu keo mùa thu (FAW) là loài sâu hại tàn phá ngô nguy hại nhất. Chúng cắn phá trực tiếp các lá non bên trong loa kèn làm cây ngô bị cụt đọt, giảm nghiêm trọng năng suất:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> PHÁC ĐỒ ĐIỀU TRỊ KHẨN CẤP:
                        </p>
                        <ul class="list-disc pl-3 mt-2 text-xs space-y-1">
                            <li><strong>Phát hiện sớm:</strong> Kiểm tra ruộng ngô hàng tuần, phát hiện sớm các vết cạp biểu bì lá dạng sọc đứt quãng.</li>
                            <li><strong>Phòng trừ sinh học:</strong> Phun chế phẩm vi khuẩn Bacillus thuringiensis hoặc virus NPV khi sâu ở tuổi 1-2 (sâu còn nhỏ dưới 1cm).</li>
                            <li><strong>Phòng trừ hóa học:</strong> Sử dụng hoạt chất thế hệ mới có tính thẩm thấu mạnh như Chlorantraniliprole hoặc Spinetoram. Phun thẳng vào ngọn loa kèn vào lúc chiều mát hoặc sáng sớm lúc sâu chui ra ăn.</li>
                        </ul>
                    </div>`
            }
        ]
    },
    {
        id: "cam-nang-lua-mi",
        title: "Cẩm nang canh tác Lúa mì ôn đới",
        category: "guide",
        size: "6.8 MB",
        desc: "Kỹ thuật gieo trồng lúa mì vụ đông và vụ xuân, quản lý nước bón phân và phòng trị hiệu quả bệnh rỉ sắt hại lá.",
        cover: "https://giacatloi.vn/wp-content/uploads/2021/02/lua-mi-tay-au-1600057056197789369742.jpg",
        chapters: [
            {
                title: "Chương 1: Phân loại giống & Kỹ thuật gieo sạ",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Kỹ thuật trồng Lúa mì đông và lúa mì xuân</h3>
                    <p class="mb-4 text-slate-600">Lúa mì cần được canh tác dựa trên các thông số thời tiết và đặc tính giống cụ thể để bông to chắc hạt:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Lúa mì mùa đông:</strong> Gieo vào mùa thu (tháng 9-10). Cần trải qua quá trình 'xuân hóa' (vernalization) ở nhiệt độ 2 - 8°C trong 4-6 tuần để chuyển sang giai đoạn sinh sản trổ bông.</li>
                        <li><strong>Lúa mì mùa xuân:</strong> Gieo vào đầu xuân ngay khi đất bắt đầu tan băng (tháng 3-4). Có thời gian sinh trưởng ngắn hơn và không cần xuân hóa bắt buộc.</li>
                        <li><strong>Thông số gieo:</strong> Lượng hạt giống gieo sạ từ 120 - 160 kg/ha. Độ sâu gieo hạt từ 2 - 4 cm tùy thuộc độ ẩm đất mặt.</li>
                    </ul>
                    <table class="w-full text-xs text-slate-600 border border-slate-200 rounded-xl overflow-hidden mb-4">
                        <thead class="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                                <th class="border border-slate-200 p-2 text-left">Đặc tính giống</th>
                                <th class="border border-slate-200 p-2 text-left">Thời vụ gieo</th>
                                <th class="border border-slate-200 p-2 text-left">Độ ẩm đất lý tưởng</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Lúa mì đông</td>
                                <td class="border border-slate-200 p-2">Nhiệt độ gieo phù hợp 15-18°C</td>
                                <td class="border border-slate-200 p-2">60 - 70% sức chứa ẩm tối đa</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Lúa mì xuân</td>
                                <td class="border border-slate-200 p-2">Nhiệt độ gieo phù hợp >5°C</td>
                                <td class="border border-slate-200 p-2">70 - 75% sức chứa ẩm tối đa</td>
                            </tr>
                        </tbody>
                    </table>`
            },
            {
                title: "Chương 2: Dinh dưỡng & Quản lý độ ẩm",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Kiểm soát Đạm bón & Nước tưới</h3>
                    <p class="mb-4 text-slate-600">Dinh dưỡng đạm trên lúa mì ảnh hưởng lớn đến nguy cơ đổ ngã và hàm lượng gluten trong bột mì:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Dinh dưỡng Nitơ:</strong> Bón chia làm 3 lần (lót lúc gieo, thúc lúc nảy chồi và thúc lúc đứng cái kéo lóng). Bón thừa đạm ở cuối vụ sẽ làm tăng hàm lượng protein thô nhưng rễ yếu khiến cây ngã rạp khi mưa gió.</li>
                        <li><strong>Vi lượng Kẽm & Đồng:</strong> Rất quan trọng ở các vùng đất cát hoặc đất kiềm, phun qua lá ở giai đoạn đẻ nhánh để tránh bông bị bạc hạt đầu bông.</li>
                        <li><strong>Tưới nước bổ sung:</strong> Lúa mì rất nhạy cảm với hạn ở hai giai đoạn: đứng cái làm đòng và ngậm sữa chín sáp. Thiếu nước giai đoạn này làm hạt lúa mì bị nhăn nheo, teo nhỏ.</li>
                    </ul>`
            },
            {
                title: "Chương 3: Kiểm soát bệnh rỉ sắt hại lá & Nấm độc hại",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Phòng trừ bệnh Rỉ Sắt (Rust Disease) & Fusarium</h3>
                    <p class="mb-4 text-slate-600">Bệnh rỉ sắt do nấm Puccinia spp. gây ra, phá hoại lớp mô biểu bì lá, cản trở quang hợp nghiêm trọng:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> PHÒNG TRỊ RỈ SẮT & FUSARIUM:
                        </p>
                        <p class="text-xs mt-1">Khi phát hiện các ổ nổi màu vàng tươi hoặc nâu đỏ rỉ sắt trên phiến lá lúa mì, cần phun ngay thuốc trừ nấm có hoạt chất nhóm Triazole (như Tebuconazole hoặc Propiconazole) kịp thời.</p>
                        <p class="text-xs mt-2">Đối với bệnh thối đầu bông Fusarium (Fusarium Head Blight) sinh độc tố gây hại sức khỏe người tiêu dùng, cần luân canh đất trồng với cây lá rộng và phun ngừa bằng Strobilurin lúc lúa mì bắt đầu nở hoa rộ.</p>
                    </div>`
            }
        ]
    },
    {
        id: "cam-nang-dau-nanh",
        title: "Kỹ thuật canh tác Đậu nành hiệu quả",
        category: "guide",
        size: "5.4 MB",
        desc: "Quy trình chăm sóc đậu nành (đậu tương), tối ưu hóa nốt sần rễ cố định đạm và kiểm soát các dịch sâu hại đục thân.",
        cover: "https://cafefcdn.com/thumb_w/640/203337114487263232/2025/4/21/photo1745227131512-174522713160223690136-17452374505941118247625.jpg",
        chapters: [
            {
                title: "Chương 1: Cơ chế cộng sinh Rhizobium & Dinh dưỡng",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Tối ưu hóa cố định đạm sinh học tự nhiên</h3>
                    <p class="mb-4 text-slate-600">Rễ đậu nành (đậu tương) có khả năng cộng sinh chặt chẽ với vi khuẩn Rhizobium japonicum tạo nên các nốt sần có tác dụng tự tổng hợp đạm tự nhiên từ khí trời:</p>
                    <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">lightbulb</span> MẸO KHUYẾN NÔNG:
                        </p>
                        <p class="text-xs mt-1">Không nên bón quá nhiều phân đạm hóa học (phân Ure) từ đầu vụ. Thừa đạm đất cây đậu nành sẽ ngừng sản xuất chất kích thích vi khuẩn xâm nhập, từ đó rễ không tạo nốt sần hoặc nốt sần bị thoái hóa sớm không hoạt động.</p>
                    </div>
                    <table class="w-full text-xs text-slate-600 border border-slate-200 rounded-xl overflow-hidden mb-4">
                        <thead class="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                                <th class="border border-slate-200 p-2 text-left">Loại phân bón</th>
                                <th class="border border-slate-200 p-2 text-left">Công thức chuẩn / ha</th>
                                <th class="border border-slate-200 p-2 text-left">Lưu ý bón phân</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Phân lân Super Lân</td>
                                <td class="border border-slate-200 p-2">350 - 400 kg (Bón lót)</td>
                                <td class="border border-slate-200 p-2">Giúp kích thích sinh trưởng rễ non, tạo nền nốt sần.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Phân đạm Ure</td>
                                <td class="border border-slate-200 p-2">30 - 40 kg (Bón mồi cây con)</td>
                                <td class="border border-slate-200 p-2">Chỉ bón lượng mồi nhỏ giai đoạn l cây ra 1-2 lá.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Phân Kali clorua</td>
                                <td class="border border-slate-200 p-2">80 - 100 kg (Bón thúc hoa quả)</td>
                                <td class="border border-slate-200 p-2">Thúc hoa đẻ nhiều quả, hạn chế rụng quả non.</td>
                            </tr>
                        </tbody>
                    </table>`
            },
            {
                title: "Chương 2: Kỹ thuật gieo trồng & Chăm sóc gốc",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Khoảng cách gieo sạ & Quản lý độ ẩm ruộng đậu</h3>
                    <p class="mb-4 text-slate-600">Đảm bảo mật độ gieo trồng giúp ruộng đậu thông thoáng và dễ xử lý sâu bệnh:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Mật độ khoảng cách:</strong> Hàng cách hàng 35-40 cm, cây cách cây 10-15 cm trên luống rộng 1.0 - 1.2m. Mật độ tối ưu khoảng 200.000 - 220.000 cây/ha.</li>
                        <li><strong>Làm cỏ xới đất phá váng:</strong> Tiến hành xới đất lần đầu khi cây đậu cao khoảng 10cm để bộ rễ tơi xốp, thông thoáng khí giúp rễ hấp thụ dinh dưỡng tốt hơn.</li>
                        <li><strong>Giai đoạn ra hoa tạo quả:</strong> Đây là giai đoạn cây rất mẫn cảm với khô hạn. Thiếu nước giai đoạn này sẽ dẫn đến việc hoa bị rụng hàng loạt và lép hạt nghiêm trọng, nông dân cần tưới thấm rãnh duy trì độ ẩm ổn định.</li>
                    </ul>`
            },
            {
                title: "Chương 3: Quản lý sâu đục thân & Sâu hại quả",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Phòng trị ruồi đục thân & Sâu đục quả</h3>
                    <p class="mb-4 text-slate-600">Sâu hại chính trên đậu nành bao gồm ruồi đục thân hại cây con và sâu đục quả non làm rỗng hạt:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> CẢNH BÁO SÂU ĐỤC QUẢ & RUỒI ĐỤC THÂN:
                        </p>
                        <p class="text-xs mt-1"><strong>Ruồi đục thân (Melanagromyza sojae):</strong> Ấu trùng đục sâu vào tủy thân từ giai đoạn cây con làm cây héo úa và chết rạp rải rác. Cần rải thuốc hạt gốc Cartap xuống rãnh gieo cùng hạt giống.</p>
                        <p class="text-xs mt-2"><strong>Sâu đục quả (Helicoverpa armigera):</strong> Phun dịch Bacillus thuringiensis hoặc tinh dầu neem khi bướm đẻ trứng rộ đầu thời kỳ ra quả. Chỉ dùng hóa chất khi mật độ trứng hoặc sâu non chớm xuất hiện trên vỏ quả.</p>
                    </div>`
            }
        ]
    },
    {
        id: "cam-nang-san-khoai-mi",
        title: "Kỹ thuật canh tác Sắn (Khoai mì) bền vững",
        category: "guide",
        size: "7.1 MB",
        desc: "Sổ tay chuẩn bị hom sắn chất lượng, kỹ thuật chống rửa trôi đất dốc và kiểm soát dịch rệp sáp bột hồng.",
        cover: "https://ducthanhco.vn/wp-content/uploads/2022/10/ky-thuat-trong-mi.jpg",
        chapters: [
            {
                title: "Chương 1: Chọn hom giống & Chống rửa trôi đất dốc",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Lựa chọn hom giống sắn tiêu chuẩn & Kỹ thuật canh tác đất dốc</h3>
                    <p class="mb-4 text-slate-600">Đối với cây sắn, khâu chuẩn bị hom giống chất lượng cao và cách canh tác trên đất đồi dốc quyết định năng suất tinh bột cuối vụ:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Tiêu chuẩn hom sắn giống:</strong> Lấy từ cây sắn phát triển khỏe mạnh không sâu bệnh từ 8-10 tháng tuổi. Lấy đoạn giữa thân, tránh dùng phần gốc quá già hoặc phần ngọn quá non. Chiều dài hom sắn đạt 15-20 cm với ít nhất 4-6 mắt mầm sống khỏe.</li>
                        <li><strong>Kỹ thuật giâm hom sắn nghiêng:</strong> Đặt hom nghiêng góc 45 độ hướng mầm lên trên. Cách đặt này giúp bộ rễ phát triển tập trung về một phía, các củ xếp đều tạo điều kiện gom tinh bột tốt hơn và rất dễ nhổ củ bằng tay khi thu hoạch.</li>
                        <li><strong>Trồng sắn chống xói mòn trên đất dốc:</strong> Trồng sắn dọc theo đường đồng mức chéo, xen canh các băng cỏ Vetiver hoặc hàng cây lạc dại dọc sườn đồi dốc để ngăn nước mưa rửa trôi đất mặt giàu mùn.</li>
                    </ul>`
            },
            {
                title: "Chương 2: Chế độ phân bón thúc tăng tinh bột",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Quy trình dinh dưỡng nâng cao chữ đường cho sắn</h3>
                    <p class="mb-4 text-slate-600">Sắn hút dinh dưỡng từ đất rất mạnh, đặc biệt yêu cầu lượng phân bón Kali cực cao để chuyển hóa hữu cơ sang tinh bột chứa trong củ:</p>
                    <table class="w-full text-xs text-slate-600 border border-slate-200 rounded-xl overflow-hidden mb-4">
                        <thead class="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                                <th class="border border-slate-200 p-2 text-left">Lần bón</th>
                                <th class="border border-slate-200 p-2 text-left">Thời điểm bón</th>
                                <th class="border border-slate-200 p-2 text-left">Công thức bón (ha)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Bón lót</td>
                                <td class="border border-slate-200 p-2">Trước khi trồng hom sắn</td>
                                <td class="border border-slate-200 p-2">500kg Hữu cơ + 250kg Super lân + 20kg Kali clorua</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Bón thúc đợt 1</td>
                                <td class="border border-slate-200 p-2">30 - 40 ngày sau trồng</td>
                                <td class="border border-slate-200 p-2">80kg Ure + 40kg Kali clorua (Xới xáo gốc nhẹ)</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Bón thúc đợt 2</td>
                                <td class="border border-slate-200 p-2">80 - 90 ngày sau trồng</td>
                                <td class="border border-slate-200 p-2">50kg Ure + 80kg Kali clorua (Giai đoạn hình thành củ)</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">lightbulb</span> MẸO KHUYẾN NÔNG:
                        </p>
                        <p class="text-xs mt-1">Tuyệt đối không bón phân đạm hóa học muộn sau 5 tháng tuổi. Bón đạm muộn sẽ kích thích sắn ra thêm cành lá non làm rỗng củ, ruột củ bị xốp và lượng tinh bột trong củ giảm đi đáng kể.</p>
                    </div>`
            },
            {
                title: "Chương 3: Rệp sáp bột hồng & Khảm lá virus",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Đối phó với Rệp sáp bột hồng & Bệnh khảm lá</h3>
                    <p class="mb-4 text-slate-600">Hai dịch hại nguy hiểm tàn phá năng suất sắn lớn nhất tại Việt Nam hiện nay:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> HƯỚNG DẪN KHỐNG CHẾ BỆNH DỊCH SẮN:
                        </p>
                        <p class="text-xs mt-1"><strong>Rệp sáp bột hồng (Phenacoccus manihoti):</strong> Chích hút dịch nhựa phần ngọn làm cành sắn thun lại như chổi sể. Áp dụng phương pháp thả ong ký sinh sinh học Anagyrus lopezi hoặc phun dầu khoáng neem vào đầu mùa khô hạn.</p>
                        <p class="text-xs mt-2"><strong>Bệnh khảm lá sắn virus:</strong> Do bọ phấn trắng Bemisia tabaci truyền bệnh hoặc lây qua hom nhiễm virus. Biện pháp duy nhất là sử dụng giống kháng sạch bệnh (như HN1, HN3, HN5) và nhổ bỏ tiêu hủy triệt để gốc cây bệnh ngay khi phát hiện đốm khảm vàng lá.</p>
                    </div>`
            }
        ]
    },
    {
        id: "cam-nang-khoai-lang",
        title: "Cẩm nang trồng Khoai lang lấy củ lớn",
        category: "guide",
        size: "4.9 MB",
        desc: "Kỹ thuật vun luống thoát nước, bón phân kali cân đối kích thích phình củ và phòng trừ sùng khoang hại củ.",
        cover: "https://cdn.tgdd.vn/Files/2021/03/03/1332190/cach-trong-khoai-lang-tai-nha-dam-bao-cho-cu-ngon-ngot-202206061039568323.jpg",
        chapters: [
            {
                title: "Chương 1: Vun luống cao & Đặt dây giống giống",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Tạo không gian tơi xốp cho khoai phình củ</h3>
                    <p class="mb-4 text-slate-600">Khoai lang yêu cầu đất cực kỳ tơi xốp, sâu để củ phát triển chiều dài mà không bị vẹo củ:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Vun luống cao thoát nước:</strong> Lên luống cao từ 30 - 35 cm, mặt luống rộng 40 - 50 cm. Chân luống đạt 80cm để đảm bảo rãnh thoát nước sâu ráo nước tuyệt đối, tránh củ bị thối úng khi mưa ngập ruộng kéo dài.</li>
                        <li><strong>Kỹ thuật đặt dây giống:</strong> Đặt dây khoai lang nằm ngang song song mặt luống hoặc xiên nhẹ, lấp đất chừa lại 3-4 mắt lá ở phần ngọn hướng lên trên. Đảm bảo lấp ít nhất 3-4 mắt dây dưới lòng đất vì đây chính là các vị trí rễ phình ra hình thành củ khoai sau này.</li>
                        <li><strong>Loại đất trồng phù hợp:</strong> Đất cát pha thịt nhẹ, giàu dinh dưỡng hữu cơ và có độ pH thích hợp từ 5.5 đến 6.5.</li>
                    </ul>`
            },
            {
                title: "Chương 2: Phân bón Kali phình củ chuyên sâu",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Quy trình phân bón thúc củ khoai lang đạt chuẩn</h3>
                    <p class="mb-4 text-slate-600">Dinh dưỡng đạm quá cao sẽ làm khoai lang chỉ 'tốt dây hại củ'. Phải tăng cường Kali clorua đúng thời điểm:</p>
                    <table class="w-full text-xs text-slate-600 border border-slate-200 rounded-xl overflow-hidden mb-4">
                        <thead class="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                                <th class="border border-slate-200 p-2 text-left">Giai đoạn</th>
                                <th class="border border-slate-200 p-2 text-left">Phác đồ bón / ha</th>
                                <th class="border border-slate-200 p-2 text-left">Lưu ý nông học</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Bón lót lúc gieo</td>
                                <td class="border border-slate-200 p-2">500kg Phân hữu cơ + 300kg Lân + 20kg Kali</td>
                                <td class="border border-slate-200 p-2">Rải sâu lòng luống rồi lấp đất mỏng trước khi gieo dây.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Thúc đợt 1 (25 ngày sau trồng)</td>
                                <td class="border border-slate-200 p-2">40kg Ure + 40kg Kali clorua</td>
                                <td class="border border-slate-200 p-2">Hỗ trợ phát triển dây lá non phủ đất.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Thúc đợt 2 (45-50 ngày sau trồng)</td>
                                <td class="border border-slate-200 p-2">20kg Ure + 80-100kg Kali clorua</td>
                                <td class="border border-slate-200 p-2">Giai đoạn phình củ lớn. Kali giúp đẩy nhanh tốc độ tích tụ tinh bột.</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> CẢNH BÁO "ĐIÊN DÂY KHOAI":
                        </p>
                        <p class="text-xs mt-1">Tránh bón nhiều đạm Ure ở giai đoạn sau 40 ngày. Dư đạm sẽ khiến dây khoai bò um tùm che bóng lẫn nhau, cây tập trung quang hợp nuôi cành lá, bộ rễ không phình củ hoặc củ lép còi.</p>
                    </div>`
            },
            {
                title: "Chương 3: Tiêu diệt Sùng đục củ (Bọ hà) hại khoai",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Xử lý dứt điểm sùng bọ hà đục củ</h3>
                    <p class="mb-4 text-slate-600">Sùng bọ hà (Cylas formicarius) là loài côn trùng đục hầm sâu trong củ khoai lang làm củ bị thối đen, sản sinh ra chất đắng độc hại không bán được:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Kỹ thuật vun luống kín đất ruộng:</strong> Đây là biện pháp sinh học cơ giới quan trọng nhất. Phải thường xuyên kiểm tra ruộng khoai, vun đất bít kín các vết nứt nẻ dọc luống. Bọ hà đẻ trứng thông qua khe nứt đất để chui xuống đẻ trực tiếp vào vỏ củ khoai.</li>
                        <li><strong>Biện pháp sinh học phòng ngừa bọ hà:</strong> Tưới drenching dung dịch nấm đối kháng Beauveria bassiana hoặc Metarhizium anisopliae xuống gốc luống lúc ngâm củ ngầm để diệt ấu trùng non.</li>
                        <li><strong>Luân canh nước ruộng lúa:</strong> Những ruộng thường xuyên bị bọ hà phá hại nặng cần được luân canh trồng lúa nước hoặc cho ngập nước ruộng ít nhất 2 tuần trước khi gieo trồng khoai lang vụ mới.</li>
                    </ul>`
            }
        ]
    },
    {
        id: "cam-nang-khoai-tay",
        title: "Kỹ thuật trồng Khoai tây thương phẩm",
        category: "guide",
        size: "8.1 MB",
        reads: 1050,
        rating: 4.9,
        desc: "Kỹ thuật canh tác khoai tây vụ đông, vun gốc lấp củ ngăn ngừa độc tố Solanine và quản lý bệnh mốc sương.",
        cover: "https://cdn.tgdd.vn/Files/2020/03/12/1241602/cach-trong-khoai-tay-don-gian-tai-nha-tu-cu-moc-mam-202003121025171359.jpg",
        chapters: [
            {
                title: "Chương 1: Trồng vụ đông miền Bắc & Chuẩn bị giống",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Lịch gieo vụ đông & Kỹ thuật xử lý củ giống</h3>
                    <p class="mb-4 text-slate-600">Khoai tây sinh trưởng tốt trong khí hậu mát mẻ và hanh khô của mùa đông miền Bắc Việt Nam:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Thời vụ vàng canh tác khoai tây:</strong> Gieo trồng từ ngày 15 tháng 10 đến ngày 10 tháng 11 dương lịch. Gieo muộn sau vụ đông sẽ gặp mưa dông cuối mùa hoặc nắng nóng xuân làm hỏng củ giống.</li>
                        <li><strong>Xử lý củ giống cắt lát:</strong> Chọn củ giống khỏe mạnh nặng khoảng 30-50g có mầm rõ ràng. Nếu cắt củ to để tiết kiệm giống, cần cắt lát bằng dao bén sát trùng cồn, chấm mặt cắt vào xi măng bột hoặc tro bếp mịn để hút khô mủ và tránh thối củ giống khi đặt lòng luống.</li>
                        <li><strong>Luống đôi trồng khoai tây:</strong> Lên luống rộng 1.2m trồng hai hàng chéo nanh sấu, khoảng cách củ cách củ đạt 25 - 30 cm.</li>
                    </ul>`
            },
            {
                title: "Chương 2: Vun gốc lấp củ & Ngăn ngừa độc tố Solanine",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Ngăn ngừa củ khoai tây hóa xanh vỏ</h3>
                    <p class="mb-4 text-slate-600">Khi củ khoai tây non nhô lên trên mặt luống tiếp xúc trực tiếp với ánh nắng mặt trời, vỏ củ chuyển sang màu xanh lục do diệp lục phát triển. Đi kèm với nó là sự sinh ra độc tố Glycoalkaloid Solanine vô cùng nguy hiểm cho người ăn:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> LỊCH VUN GỐC BẮT BUỘC:
                        </p>
                        <ul class="list-disc pl-3 mt-2 text-xs space-y-1">
                            <li><strong>Vun gốc lần 1:</strong> Thực hiện khi cây khoai tây mọc cao khoảng 15-20 cm. Tiến hành xới xáo nhẹ rãnh luống rồi lấp đất vào gốc cây để chừa ngọn lá trên mặt đất.</li>
                            <li><strong>Vun gốc lần 2 (Đợt bón thúc hoa củ):</strong> Thực hiện sau lần một 15-20 ngày trước khi hoa nở rộ. Vun cao lấy đất đầy đắp kín kẽ quanh tán cây che kín hoàn toàn củ khoai non nằm sâu lòng luống.</li>
                        </ul>
                    </div>`
            },
            {
                title: "Chương 3: Quản lý bệnh Mốc sương muộn & Héo xanh",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Đối phó bệnh Mốc Sương (Late Blight) & Héo Xanh</h3>
                    <p class="mb-4 text-slate-600">Bệnh mốc sương muộn là tác nhân nguy hiểm làm thối toàn bộ cây khoai tây ẩm mùa đông:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Bệnh mốc sương (Phytophthora infestans):</strong> Vết bệnh đốm ướt thối màu đen trên phiến lá, mép vết bệnh có lớp phấn sương trắng vào sáng sớm ấm ẩm. Phun ngay lập tức hoạt chất đặc trị Metalaxyl hoặc Mancozeb luân phiên để tránh kháng thuốc.</li>
                        <li><strong>Bệnh héo xanh vi khuẩn (Ralstonia solanacearum):</strong> Cây héo rũ nhanh trong khi lá vẫn giữ màu xanh nguyên vẹn. Cắt lát ngang thân thấy mạch dẫn mạch gỗ bị thâm nâu đen và có dịch nhựa vi khuẩn đọng trắng đục chảy ra. Biện pháp tốt nhất là loại bỏ cây bệnh, rải vôi bột khử trùng hố cây bệnh và luân canh lâu dài.</li>
                    </ul>`
            }
        ]
    },
    {
        id: "cam-nang-dai-mach",
        title: "Kỹ thuật canh tác Đại mạch làm Malt bia",
        category: "research",
        size: "5.0 MB",
        desc: "Nghiên cứu quy trình gieo hạt, kiểm soát dinh dưỡng đạm để đạt tiêu chuẩn làm mạch nha bia cao cấp.",
        cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSZYMEyNVOtt1MoZmpgGF00NB5nypLMJrJHOQ&s",
        chapters: [
            {
                title: "Chương 1: Dinh dưỡng đạm & Chỉ tiêu chất lượng hạt Malt",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Kiểm soát tỷ lệ protein đạt chuẩn công nghiệp</h3>
                    <p class="mb-4 text-slate-600">Đại mạch làm nguyên liệu sản xuất malt bia yêu cầu tỷ lệ protein trong hạt rất khắt khe. Nếu bón phân không đúng quy trình kỹ thuật sẽ làm giảm chất lượng mạch nha xuất khẩu:</p>
                    <table class="w-full text-xs text-slate-600 border border-slate-200 rounded-xl overflow-hidden mb-4">
                        <thead class="bg-slate-50 text-slate-700 font-bold">
                            <tr>
                                <th class="border border-slate-200 p-2 text-left">Chỉ tiêu hạt đại mạch</th>
                                <th class="border border-slate-200 p-2 text-left">Ngưỡng chuẩn làm Malt</th>
                                <th class="border border-slate-200 p-2 text-left">Hệ quả nếu ngoài ngưỡng</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Tỷ lệ Protein hạt</td>
                                <td class="border border-slate-200 p-2">9.5% - 11.5%</td>
                                <td class="border border-slate-200 p-2">Dưới 9.5%: bia thiếu bọt, lên men kém. Trên 11.5%: bia bị đục, khó lọc cặn.</td>
                            </tr>
                            <tr>
                                <td class="border border-slate-200 p-2 font-bold">Tỷ lệ nảy mầm hạt</td>
                                <td class="border border-slate-200 p-2">> 98% sau 3 ngày</td>
                                <td class="border border-slate-200 p-2">Không nảy mầm đều làm hỏng quá trình chuyển đổi tinh bột ở nhà máy bia.</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">lightbulb</span> NGUYÊN TẮC BÓN ĐẠM (NITƠ):
                        </p>
                        <p class="text-xs mt-1">Bón 70% lượng phân đạm vào giai đoạn làm đất gieo hạt, bón thúc nốt 30% lúc cây bắt đầu đẻ nhánh. Tuyệt đối không bón phân đạm muộn ở giai đoạn đại mạch đứng cái hoặc làm đòng vì sẽ đẩy hàm lượng protein hạt lên vượt mức 12% làm giảm giá trị thương phẩm đại mạch.</p>
                    </div>`
            },
            {
                title: "Chương 2: Kỹ thuật gieo hạt & Quản lý cỏ dại",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Quy trình làm đất mịn gieo đại mạch</h3>
                    <p class="mb-4 text-slate-600">Đại mạch cần nền đất bằng phẳng tơi xốp sâu để hệ rễ chùm bám đều:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Kỹ thuật gieo:</strong> Lượng giống gieo đạt 100 - 130 kg/ha tùy giống. Gieo sạ hàng bằng máy chuyên dụng giúp hàng cách hàng 15-20cm ổn định, độ sâu lấp hạt khống chế ở 2 - 3 cm.</li>
                        <li><strong>Yêu cầu đất nông nghiệp:</strong> Đất trồng thoát nước nhanh, pH tối ưu nằm trong khoảng 6.0 - 7.5. Đại mạch rất kén đất chua phèn nặng dưới 5.0.</li>
                        <li><strong>Quản lý cỏ dại lấn át:</strong> Cây đại mạch non sinh trưởng chậm dễ bị cỏ dại họ hòa thảo lấn át. Cần xử lý phun thuốc trừ cỏ tiền nảy mầm chọn lọc ngay sau khi gieo hạt giống 2-3 ngày.</li>
                    </ul>`
            },
            {
                title: "Chương 3: Kiểm soát nấm rỉ sắt & Nấm mốc hạt",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Phòng bệnh rỉ sắt đại mạch & Nấm mốc bông</h3>
                    <p class="mb-4 text-slate-600">Nấm bệnh tấn công bông hạt đại mạch làm hỏng hạt chất lượng malt:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> CẢNH BÁO BẢO QUẢN SAU THU HOẠCH:
                        </p>
                        <p class="text-xs mt-1">Đại mạch thu hoạch cần sấy khô hạ độ ẩm xuống dưới 14% lập tức để kìm hãm nấm Aspergillus flavus sinh độc tố và tránh phôi hạt tự sưởi ấm ẩm làm mất tỷ lệ nảy mầm đặc trưng của malt.</p>
                    </div>`
            }
        ]
    },
    {
        id: "cam-nang-lac-dau-phong",
        title: "Kỹ thuật trồng Lạc (Đậu phộng) năng suất",
        category: "guide",
        size: "6.2 MB",
        reads: 780,
        rating: 4.8,
        desc: "Kỹ thuật xới xáo đất vun gốc kích thích tia lạc đâm xuống đất tạo củ và cách phòng trừ nấm đốm lá.",
        cover: "https://jordan.vn/uploads/news/2022_05/thoi-vu-canh-tac-cay-lac.jpg",
        chapters: [
            {
                title: "Chương 1: Chọn giống, Gieo hạt & Dinh dưỡng thạch cao",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Kỹ thuật bóc vỏ hạt giống & Yêu cầu Calci đất</h3>
                    <p class="mb-4 text-slate-600">Lạc (đậu phộng) có lớp vỏ gỗ bảo vệ hạt, việc gieo trồng hiệu quả cần tuân thủ kỹ thuật gieo hạt giống chuẩn:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Xử lý hạt giống lạc:</strong> Chỉ bóc vỏ củ lấy hạt giống trước khi gieo sạ từ 1-2 ngày. Bóc sớm hạt tiếp xúc không khí ấm ẩm hấp thụ hơi nước làm hạt giảm tỷ lệ nảy mầm. Xử lý hạt bằng chế phẩm trừ nấm phòng chết rạp cây con.</li>
                        <li><strong>Khoảng cách trồng lạc:</strong> Trồng hàng đơn cách hàng 25 - 30 cm, hạt cách hạt 10 - 15 cm. Độ sâu gieo hạt 3 - 5 cm.</li>
                        <li><strong>Dinh dưỡng Thạch cao (Calci Sulfat):</strong> Lạc rất cần Canxi để vỏ quả đanh chắc hạt chắc mẩy. Bón lót thạch cao (300-400 kg/ha) ở giai đoạn lạc ra hoa rộ để vỏ quả hấp thụ trực tiếp từ đất.</li>
                    </ul>`
            },
            {
                title: "Chương 2: Kỹ thuật vun gốc tạo tia củ (Pegging)",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Hỗ trợ tia lạc đâm sâu xuống đất tạo quả</h3>
                    <p class="mb-4 text-slate-600">Hoa lạc nở trên cành trên không nhưng sau khi thụ phấn, tia lạc (phóng từ đài hoa gọi là gynophore) vươn dài đâm chúi xuống lòng đất để củ phình to lớn:</p>
                    <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">lightbulb</span> MẸO KHUYẾN NÔNG:
                        </p>
                        <p class="text-xs mt-1">Khi lạc bắt đầu ra hoa rộ hàng loạt, nông dân cần tiến hành làm cỏ sạch, xới tơi lớp đất mặt và vun đất nhẹ sát quanh gốc cây tạo nền đất xốp sâu mịn. Tránh động rễ hoặc cuốc xới gốc sau khi tia lạc đã đâm đọt sâu xuống đất vì dễ làm gãy rụng cuống tia gây thối củ lạc non.</p>
                    </div>`
            },
            {
                title: "Chương 3: Bệnh đốm lá & Độc tố Aflatoxin nguy hại",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Phòng đốm lá trễ & Kiểm soát độc tố Aflatoxin</h3>
                    <p class="mb-4 text-slate-600">Đốm lá làm rụng lá rụng rốn nuôi củ, đồng thời nấm mốc trong hạt lạc sinh ra độc tố cực mạnh gây ung thư gan Aflatoxin:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> CẢNH BÁO AFLATOXIN NGUY HIỂM:
                        </p>
                        <p class="text-xs mt-1">Ấu trùng nấm Aspergillus flavus xâm nhập củ lạc lúc đất bị khô hạn giai đoạn tạo củ. Sau thu hoạch, cần phơi phóng ngay cả củ đạt ẩm xuống dưới 9% để kìm hãm hoàn toàn mầm mốc ẩm. Loại bỏ tuyệt đối hạt lép hạt mốc vỏ trước khi đưa vào kho bảo quản cất giữ.</p>
                    </div>`
            }
        ]
    },
    {
        id: "cam-nang-ke",
        title: "Canh tác Kê hạt nhỏ chịu hạn cực độ",
        category: "guide",
        size: "3.5 MB",
        reads: 390,
        rating: 4.6,
        desc: "Kỹ thuật trồng cây kê hạt nhỏ trên đất cát nghèo dinh dưỡng, phòng chim phá hoại bông chín.",
        cover: "https://cdn.tgdd.vn/Files/2021/08/28/1378437/hat-ke-la-gi-tac-dung-va-cach-dung-hat-ke-dung-cach-202108280951580410.jpg",
        chapters: [
            {
                title: "Chương 1: Kỹ thuật trồng kê chịu hạn thích ứng khí hậu",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Trồng cây kê thích ứng hạn mặn</h3>
                    <p class="mb-4 text-slate-600">Cây kê hạt nhỏ (Foxtail millet) có hệ rễ chùm ăn sâu cắm chặt vào lòng đất cát dốc chịu hạn vượt trội thích ứng hiệu quả với biến đổi khí hậu:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Làm đất mịn gieo hạt giống:</strong> Do hạt kê rất nhỏ, đất mặt ruộng gieo sạ cần được cày ải bừa kỹ san thật mịn phẳng để khi gieo hạt tiếp xúc đều bùn đất ẩm giúp tỷ lệ mọc mầm đều 100%.</li>
                        <li><strong>Mật độ gieo hạt kê giống:</strong> Lượng hạt gieo đạt từ 8 - 10 kg/ha, hàng cách hàng từ 30-40 cm, độ sâu gieo hạt mỏng chỉ 1.5 - 2 cm.</li>
                        <li><strong>Nước tưới:</strong> Giai đoạn cây con cần tưới nhẹ giữ ẩm. Cây kê lớn lên có lớp lông sáp lá ngăn bay hơi nước, không cần tưới bổ sung nhiều nước.</li>
                    </ul>`
            },
            {
                title: "Chương 2: Sâu bệnh hại cây kê non & Chăm sóc rễ",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Xử lý ruồi đục đỉnh sinh trưởng kê non</h3>
                    <p class="mb-4 text-slate-600">Cây kê sinh trưởng khỏe mạnh ở vùng khô cằn nhưng giai đoạn cây con dễ bị các loài dịch hại tàn phá:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Ruồi đục đọt non (Atherigona soccata):</strong> Đẻ trứng đỉnh ngọn non cây kê con làm héo đọt non khô ngọn. Trị sớm bằng việc ngâm xử lý hạt giống bằng thuốc đặc trị bảo vệ gốc hoặc gieo sạ đồng loạt tập trung đầu vụ.</li>
                        <li><strong>Làm cỏ đợt sớm:</strong> Do cây kê con mọc rễ còi ban đầu, nông dân cần làm cỏ bằng tay sạch ở giai đoạn 15 và 30 ngày sau gieo tránh bị cỏ dại lấn át quang hợp.</li>
                    </ul>`
            },
            {
                title: "Chương 3: Kỹ thuật thu hoạch kê tránh rụng hạt tự do",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Phòng chim phá bông kê & Thời điểm gặt quả chín</h3>
                    <p class="mb-4 text-slate-600">Bông kê có hạt nhỏ dẹt chín rất hấp dẫn đối với các đàn chim di cư cắn phá phá ruộng:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> CẢNH BÁO HAO HỤT THU HOẠCH KÊ:
                        </p>
                        <p class="text-xs mt-1">Cần tiến hành gặt bông kê ngay khi có khoảng 80% bông hạt trên toàn ruộng chuyển vàng rơm chín sinh lý. Tránh để kê chín quá muộn gặp mưa gió làm vỏ hạt dễ rụng tự do hàng loạt xuống đất ruộng gây thất thoát năng suất củ.</p>
                    </div>`
            }
        ]
    },
    {
        id: "cam-nang-cao-luong",
        title: "Hướng dẫn canh tác Cao lương (Sorghum)",
        category: "research",
        size: "5.8 MB",
        reads: 520,
        rating: 4.7,
        desc: "Nghiên cứu cây cao lương chịu hạn, kỹ thuật ủ chua sinh học làm thức ăn chăn nuôi và quản lý độc tố xyanua.",
        cover: "https://cdn.nhathuoclongchau.com.vn/unsafe/800x0/cay_cao_luong_5df1202767.jpg",
        chapters: [
            {
                title: "Chương 1: Chọn giống cao lương & Kỹ thuật thích ứng khô hạn",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Năng suất sinh khối lớn của cây cao lương</h3>
                    <p class="mb-4 text-slate-600">Cao lương (Sorghum) là cây trồng đa dụng thích hợp cho vùng hạn, sinh trưởng lá xanh tốt năng suất cỏ xanh nuôi bò lớn:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Thông số gieo cao lương giống:</strong> Lượng hạt gieo đạt 10 - 12 kg/ha, hàng cách hàng rộng 60-70 cm, cây cách cây 15-20 cm để tận dụng tối đa ánh sáng mặt trời mặt đồi dốc. Độ sâu đặt hạt giống khoảng 2.5 - 3.5 cm.</li>
                        <li><strong>Phân bón NPK tổng hợp:</strong> Lượng phân cần bón khoảng 80kg Đạm Ure + 40kg Phân lân + 40kg Kali clorua cho 1 ha ruộng gieo.</li>
                        <li><strong>Cơ chế sinh lý thích ứng hạn:</strong> Thân lá cao lương có phủ một lớp phấn sáp trắng ngăn thoát hơi nước mặt ngoài biểu bì và rễ sâu chống khô hạn tốt hơn ngô.</li>
                    </ul>`
            },
            {
                title: "Chương 2: Cảnh báo độc tố Xyanua ở cây cao lương non",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Nhận diện ngộ độc axit xyanhydric (HCN) ở vật nuôi</h3>
                    <p class="mb-4 text-slate-600">Mặc dù thân lá cao lương là thức ăn xanh giàu xơ dinh dưỡng cho gia súc trâu bò, nhưng cây non chứa độc tố tự nhiên nguy hại:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> CẢNH BÁO ĐỘC TỐ XYANUA CỰC ĐỘC:
                        </p>
                        <p class="text-xs mt-1">Cây cao lương non cao dưới 60cm hoặc cây bị còi cọc do sương giá/khô hạn chứa glycoside dhurrin. Khi động vật ăn vào, men ruột phân hủy dhurrin thành axit xyanhydric (Xyanua) tự do thấm nhanh vào máu ngăn cản trao đổi oxy gây ngạt thở tế bào động vật dẫn đến tử vong nhanh chóng.</p>
                        <p class="text-xs mt-2"><strong>Quy tắc chăn thả an toàn:</strong> Tuyệt đối không cho trâu bò ăn cỏ tươi chăn thả ở ruộng cao lương non cao dưới 60cm. Cỏ cao lương sau khi ủ chua lên men vi sinh hoàn toàn an toàn do axit xyanua bị phân hủy trong quá trình ủ.</p>
                    </div>`
            },
            {
                title: "Chương 3: Quy trình ủ chua sinh học làm thức ăn xanh chăn nuôi",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Lên men chua lactic thân lá cao lương</h3>
                    <p class="mb-4 text-slate-600">Ủ chua là phương pháp dự trữ thức ăn hiệu quả giúp phân hủy độc tố cây cao lương non:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Thu hoạch nguyên liệu cỏ:</strong> Cắt toàn bộ thân lá cây cao lương khi hạt ở giai đoạn chín sữa bông hạt ngậm sữa (lúc này hàm lượng tinh bột đường tích tụ lá cao nhất).</li>
                        <li><strong>Băm nhỏ thân lá:</strong> Sử dụng máy băm cỏ băm thân thành lát nhỏ ngắn khoảng 2 - 3 cm.</li>
                        <li><strong>Bổ sung rỉ mật đường kích men:</strong> Trộn đều nguyên liệu băm với 2-3% rỉ mật đường hoặc cám gạo khô. Nén chặt hỗn hợp cỏ vào hố ủ lót bạt kín khí bọc nilon bọc kín hoàn toàn miệng hố ủ. Sau 21 ngày lên men chua lactic chua ngọt vật nuôi ăn rất ngon miệng.</li>
                    </ul>`
            }
        ]
    },
    {
        id: "cam-nang-yen-mach",
        title: "Kỹ thuật canh tác Yến mạch ôn đới",
        category: "research",
        size: "4.7 MB",
        reads: 610,
        rating: 4.8,
        desc: "Nghiên cứu thời điểm gieo trồng yến mạch đầu xuân, phòng chống bệnh đốm sọc và tuyến trùng rễ hại lúa mạch.",
        cover: "https://tiki.vn/blog/wp-content/uploads/2023/03/yen-mach-giam-can.jpg",
        chapters: [
            {
                title: "Chương 1: Chọn giống yến mạch & Kỹ thuật gieo xuân sớm",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Tận dụng nước tuyết tan xuân trồng yến mạch</h3>
                    <p class="mb-4 text-slate-600">Yến mạch (Avena sativa) là cây lương thực chịu lạnh ôn đới sinh trưởng mạnh ở đầu vụ xuân mát mẻ:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Thời vụ gieo trồng xuân sớm:</strong> Gieo hạt ngay khi lớp tuyết tan mỏng đất đạt nhiệt độ trên 5°C. Gieo sớm tận dụng tối đa độ ẩm đất và tránh đợt nắng hanh hè làm bông hạt bị lép rỗng phôi mầm.</li>
                        <li><strong>Lượng giống gieo hạt sạ:</strong> Gieo từ 100 - 120 kg hạt giống/ha. Độ sâu gieo lấp hạt lý tưởng đạt 3 - 4 cm.</li>
                        <li><strong>Dinh dưỡng Nitơ đạm yếu:</strong> Yến mạch rất nhạy cảm với đạm. Tránh bón thúc đạm muộn làm thân vươn dài bọng ruột dẫn đến ngã đổ rạp dông dập mưa bông lúa mạch.</li>
                    </ul>`
            },
            {
                title: "Chương 2: Kiểm soát rỉ sắt vương miện & Tuyến trùng rễ",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Đối phó tuyến trùng rễ & Nấm rỉ sắt</h3>
                    <p class="mb-4 text-slate-600">Tuyến trùng rễ và bệnh rỉ sắt vương miện là tác nhân nguy hại cho yến mạch ôn đới:</p>
                    <ul class="list-disc pl-5 mb-4 space-y-2 text-slate-600">
                        <li><strong>Tuyến trùng rễ yến mạch (CCN):</strong> Xâm nhập bộ rễ hút chất dinh dưỡng làm rễ sưng u cây còi cọc lùn lá vàng úa. Biện pháp tốt nhất là luân canh yến mạch luân phiên với cây họ đậu đỗ cải tạo đất.</li>
                        <li><strong>Bệnh rỉ sắt vương miện (Crown Rust):</strong> Do nấm Puccinia coronata gây ổ bào tử cam sáng trên phiến lá mạch. Tránh trồng gần cây hắc mai (buckthorn - ký chủ trung gian nấm bệnh). Phun ngừa Triazole khi phát hiện ổ bệnh chớm xuất hiện.</li>
                    </ul>`
            },
            {
                title: "Chương 3: Quy trình thu hoạch & Sấy khô bảo quản chống ôi dầu",
                content: `
                    <h3 class="text-xl font-black text-primary mb-3">Kỹ thuật sấy hạt yến mạch hạ độ ẩm khẩn cấp</h3>
                    <p class="mb-4 text-slate-600">Hạt yến mạch có phôi hạt chứa nhiều lipid dầu béo tốt cho sức khỏe con người nhưng cũng rất dễ bị oxy hóa gây mùi hôi khét:</p>
                    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 text-slate-700">
                        <p class="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">warning</span> CẢNH BÁO BẢO QUẢN YẾN MẠCH:
                        </p>
                        <p class="text-xs mt-1">Thu hoạch yến mạch khi độ ẩm hạt đạt 15-18% để tránh nứt hạt. Ngay sau khi suốt lấy hạt, phải đưa hạt vào buồng sấy thổi gió ấm nhẹ sấy khô hạ ẩm dưới 12% lập tức. Bảo quản yến mạch nơi khô mát kín khí râm tối, nếu để trong kho nóng ẩm cao chất béo phôi mầm phân hủy sinh mùi ôi khét mất giá trị dinh dưỡng hạt.</p>
                    </div>`
            }
        ]
    }
];

// Hàm lọc Thư viện
window.filterLibrary = function (type) {
    currentLibraryFilter = type;

    // Cập nhật class active cho các nút bộ lọc
    document.querySelectorAll('.lib-filter-btn').forEach(btn => {
        if (btn.id === `lib-filter-${type}`) {
            btn.className = 'lib-filter-btn active px-4 py-2.5 rounded-2xl text-[12px] font-black whitespace-nowrap bg-gradient-to-r from-primary to-emerald-600 text-white shadow-[0_4px_12px_rgba(13,99,27,0.15)] transition-all scale-[1.02] active:scale-95';
        } else {
            btn.className = 'lib-filter-btn px-4 py-2.5 rounded-2xl text-[12px] font-black whitespace-nowrap bg-slate-50 border border-slate-200/50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all hover:scale-[1.02] active:scale-95';
        }
    });

    renderLibraryPage();
};

// Hiển thị danh sách tài liệu
window.renderLibraryPage = function () {
    const listContainer = document.getElementById('library-documents-list');
    if (!listContainer) return;

    const searchVal = (document.getElementById('library-search-input')?.value || '').trim().toLowerCase();

    const filtered = libraryDocuments.filter(doc => {
        const matchCategory = currentLibraryFilter === 'all' || doc.category === currentLibraryFilter;
        const matchSearch = doc.title.toLowerCase().includes(searchVal) || doc.desc.toLowerCase().includes(searchVal);
        return matchCategory && matchSearch;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-center animate-fade-in animate-duration-300">
                <div class="w-20 h-20 rounded-full bg-slate-50 border border-slate-200/50 flex items-center justify-center mb-4">
                    <span class="material-symbols-outlined text-4xl text-slate-400">search_off</span>
                </div>
                <h3 class="font-bold text-slate-800 text-lg mb-1">Không tìm thấy tài liệu</h3>
                <p class="text-slate-500 text-sm max-w-[280px]">Thử tìm kiếm với từ khóa khác hoặc chuyển danh mục bộ lọc.</p>
            </div>`;
        return;
    }

    listContainer.innerHTML = filtered.map(doc => {
        const categoryLabels = {
            guide: '📖 Cẩm nang',
            research: '🧪 Nghiên cứu',
            policy: '📜 Chính sách'
        };
        const label = categoryLabels[doc.category] || 'Tài liệu';

        return `
            <div onclick="window.openDocumentReader('${doc.id}')"
                class="bg-white rounded-[24px] border border-outline-variant/30 overflow-hidden shadow-sm hover:shadow-[0_20px_50px_rgba(13,99,27,0.06)] hover:border-primary/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full animate-fade-in group">
                <!-- Book Cover Image -->
                <div class="h-44 w-full relative overflow-hidden shrink-0 select-none">
                    <img src="${doc.cover}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    <div class="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider">
                        ${label}
                    </div>
                </div>
                <!-- Book Info -->
                <div class="p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <h4 class="font-black text-slate-900 text-[14px] line-clamp-2 leading-snug group-hover:text-primary transition-colors">${doc.title}</h4>
                        <p class="text-slate-500 text-xs mt-2 line-clamp-3 leading-relaxed font-medium">${doc.desc}</p>
                    </div>
                    <!-- Footer Info -->
                    <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end text-[11px] font-bold text-slate-400 select-none">
                        <!-- Download btn with simulated progress -->
                        <button onclick="window.simulateDownload('${doc.id}', event)" id="download-btn-${doc.id}" 
                            class="relative flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-primary/[0.02] text-slate-600 hover:text-primary hover:border-primary/30 transition-all shadow-sm">
                            <!-- Circular Progress Overlay -->
                            <div id="progress-spinner-${doc.id}" class="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin hidden"></div>
                            <span id="download-icon-${doc.id}" class="material-symbols-outlined text-[16px]">download</span>
                        </button>
                    </div>
                </div>
            </div>`;
    }).join('');
};

// Trình đọc sách
window.openDocumentReader = function (docId) {
    const doc = libraryDocuments.find(d => d.id === docId);
    if (!doc) return;

    activeReaderDocId = docId;
    activeReaderChapterIdx = 0;

    const modal = document.getElementById('library-reader-modal');
    if (!modal) return;

    // Nạp tiêu đề
    document.getElementById('reader-book-title').innerText = doc.title;

    // Nạp mục lục (TOC)
    const tocContainer = document.getElementById('reader-toc');
    if (tocContainer) {
        tocContainer.innerHTML = doc.chapters.map((ch, idx) => `
            <button onclick="window.changeReaderChapter('${docId}', ${idx})" id="toc-chapter-${idx}"
                class="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all truncate flex items-center gap-2 border border-transparent ${idx === 0 ? 'bg-primary/10 text-primary border-primary/10 shadow-sm' : 'text-slate-600 hover:bg-slate-100/60'}">
                <span class="material-symbols-outlined text-[15px] shrink-0">${idx === 0 ? 'menu_book' : 'bookmark'}</span>
                <span class="truncate">${ch.title}</span>
            </button>
        `).join('');
    }

    // Cấu hình nút tải xuống trong E-Reader
    const downloadBtn = document.getElementById('reader-download-btn');
    if (downloadBtn) {
        downloadBtn.onclick = function (e) {
            window.simulateDownload(docId, e);
        };
    }

    // Nạp chương đầu tiên
    window.changeReaderChapter(docId, 0);

    // Hiển thị modal
    modal.classList.remove('invisible', 'opacity-0');
    modal.querySelector('.animate-scale-up')?.classList.add('active');
};

// Đổi chương sách trong trình đọc
window.changeReaderChapter = function (docId, chapterIndex) {
    const doc = libraryDocuments.find(d => d.id === docId);
    if (!doc || !doc.chapters[chapterIndex]) return;

    activeReaderChapterIdx = chapterIndex;

    // Cập nhật phụ đề
    document.getElementById('reader-book-subtitle').innerText = doc.chapters[chapterIndex].title;

    // Nạp nội dung
    const contentArea = document.getElementById('reader-chapter-content');
    if (contentArea) {
        contentArea.innerHTML = doc.chapters[chapterIndex].content;
        contentArea.parentElement.scrollTop = 0; // Cuộn lên đầu
    }

    // Cập nhật highlight trong TOC sidebar
    doc.chapters.forEach((_, idx) => {
        const btn = document.getElementById(`toc-chapter-${idx}`);
        if (btn) {
            if (idx === chapterIndex) {
                btn.className = 'w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all truncate flex items-center gap-2 border border-primary/10 bg-primary/10 text-primary shadow-sm';
                const icon = btn.querySelector('.material-symbols-outlined');
                if (icon) icon.innerText = 'menu_book';
            } else {
                btn.className = 'w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all truncate flex items-center gap-2 border border-transparent text-slate-600 hover:bg-slate-100/60';
                const icon = btn.querySelector('.material-symbols-outlined');
                if (icon) icon.innerText = 'bookmark';
            }
        }
    });
};

// Đóng trình đọc sách
window.closeDocumentReader = function () {
    const modal = document.getElementById('library-reader-modal');
    if (modal) {
        modal.classList.add('invisible', 'opacity-0');
    }
    activeReaderDocId = null;
};

// Điều chỉnh kích thước chữ
window.adjustReaderFontSize = function (dir) {
    readerFontSize = Math.max(12, Math.min(22, readerFontSize + dir));
    const content = document.getElementById('reader-chapter-content');
    if (content) {
        content.style.fontSize = `${readerFontSize}px`;
    }
};

// Mô phỏng tải sách với tiến trình (Simulated Download Progress)
window.simulateDownload = function (docId, event) {
    if (event) event.stopPropagation(); // Ngăn mở reader modal

    const doc = libraryDocuments.find(d => d.id === docId);
    if (!doc) return;

    const btn = document.getElementById(`download-btn-${docId}`);
    const icon = document.getElementById(`download-icon-${docId}`);
    const spinner = document.getElementById(`progress-spinner-${docId}`);

    // Vô hiệu hóa nút và hiện spinner quay
    if (btn) {
        btn.disabled = true;
        btn.classList.add('pointer-events-none');
    }
    if (icon) icon.classList.add('hidden');
    if (spinner) spinner.classList.remove('hidden');

    showToast(`Bắt đầu chuẩn bị tải xuống: ${doc.title}...`, "info");

    let progress = 0;
    const interval = setInterval(() => {
        progress += 20;
        if (progress >= 100) {
            clearInterval(interval);

            // Phục hồi giao diện
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('pointer-events-none');
            }
            if (icon) icon.classList.remove('hidden');
            if (spinner) spinner.classList.add('hidden');

            showToast(`Tải xuống thành công: ${doc.title} (${doc.size})!`, "success");

            // Tải file PDF thật (hoặc giả bằng mockup pdf)
            const a = document.createElement('a');
            a.href = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
            a.target = '_blank';
            a.download = `${doc.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }, 400);
};

// --- CHỨC NĂNG THƯ VIỆN CANH TÁC (EXPERT) ---

async function loadLibrary() {
    const grid = document.getElementById('my-library-grid');
    const accordion = document.getElementById('static-guides-accordion');
    const token = localStorage.getItem('agrisocial_token');

    if (!grid) return;

    try {
        // 1. Fetch dữ liệu chuyên gia từ Supabase
        const resMy = await fetch('/api/library/my', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const myArticles = await resMy.json();

        // 2. Fetch dữ liệu mẫu tĩnh
        const resStatic = await fetch('/api/farming-guides');
        const staticData = await resStatic.json();

        // Render My Library
        if (!myArticles || myArticles.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">Bạn chưa có bài viết nào. Hãy tạo bài đầu tiên!</div>`;
        } else {
            grid.innerHTML = myArticles.map(article => `
                <div class="glass-card flex flex-col h-full overflow-hidden">
                    <div class="h-40 bg-slate-200 relative">
                        <img src="${article.image_url || 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=400'}" class="w-full h-full object-cover">
                        <div class="absolute top-3 right-3">
                            <span class="guide-status-badge ${article.status === 'approved' ? 'status-approved' : 'status-pending'}">
                                ${article.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                            </span>
                        </div>
                    </div>
                    <div class="p-5 flex-1 flex flex-col">
                        <div class="text-[10px] font-black text-primary uppercase tracking-widest mb-1">${article.crop_type}</div>
                        <h4 class="font-bold text-slate-800 mb-2 line-clamp-2">${article.title}</h4>
                        <p class="text-xs text-slate-500 line-clamp-3 mb-4 flex-1">${article.content}</p>
                        <div class="flex border-t border-slate-100 pt-4 gap-2">
                            <button onclick="editGuide('${article.id}')" class="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Sửa</button>
                            <button onclick="deleteGuide('${article.id}')" class="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Render Static Guides (Accordion)
        if (staticData.success && accordion) {
            const guides = staticData.data;
            accordion.innerHTML = Object.entries(guides).map(([key, value]) => `
                <div class="border border-slate-100 rounded-2xl overflow-hidden bg-white/50">
                    <div class="guide-accordion-header hover:bg-white transition-colors" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">${key === 'rice' ? '🌾' : key === 'corn' ? '🌽' : '🍠'}</span>
                            <span class="font-bold text-slate-700">${value.growing.title}</span>
                        </div>
                        <span class="material-symbols-outlined text-slate-400">expand_more</span>
                    </div>
                    <div class="hidden p-5 bg-white/30 border-t border-slate-50 text-sm text-slate-600">
                        <h5 class="font-bold text-primary mb-2">Các bước thực hiện:</h5>
                        <ul class="list-disc pl-5 space-y-2">
                            ${value.growing.steps.map(s => `<li>${s.replace(/\*\*/g, '')}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `).join('');
        }

    } catch (err) {
        console.error("Lỗi tải thư viện:", err);
    }
}

window.showCreateGuideForm = function () {
    document.getElementById('guide-form')?.reset();
    document.getElementById('guide-id').value = '';
    document.getElementById('guide-modal-title').innerText = "Tạo hướng dẫn mới";
    document.getElementById('guide-modal').style.display = 'flex';
};

window.editGuide = async function (id) {
    const token = localStorage.getItem('agrisocial_token');
    try {
        const res = await fetch(`/api/library`);
        const data = await res.json();
        const article = data.find(a => String(a.id) === String(id));

        if (article) {
            document.getElementById('guide-id').value = article.id;
            document.getElementById('guide-title').value = article.title;
            document.getElementById('guide-crop-type').value = article.crop_type;
            document.getElementById('guide-content').value = article.content;
            document.getElementById('guide-image').value = article.image_url;
            document.getElementById('guide-status').value = article.status;

            document.getElementById('guide-modal-title').innerText = "Chỉnh sửa bài viết";
            document.getElementById('guide-modal').style.display = 'flex';
        }
    } catch (e) { alert("Lỗi khi lấy thông tin bài viết"); }
};

window.deleteGuide = async function (id) {
    if (!confirm("Bạn có chắc chắn muốn xóa bài hướng dẫn này?")) return;
    const token = localStorage.getItem('agrisocial_token');

    try {
        const res = await fetch(`/api/library/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
            alert("Đã xóa bài viết.");
            loadLibrary();
        }
    } catch (e) { alert("Lỗi khi xóa bài viết"); }
};

window.closeGuideModal = function () {
    document.getElementById('guide-modal').style.display = 'none';
};

// Cập nhật hàm switchTab hiện có để hỗ trợ loadLibrary
const originalSwitchTabExpert = window.switchTab;
window.switchTab = function (tabId) {
    if (typeof originalSwitchTabExpert === 'function') originalSwitchTabExpert(tabId);
    if (tabId === 'tab-library') loadLibrary();
};

window.showExpertConsultationDetail = async function (reqId) {
    const req = (window.currentExpertRequests || []).find(r => r.id === reqId);
    if (!req) return;

    const modal = document.getElementById('expert-consultation-modal');
    if (!modal) return;

    // Hiển thị modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    // Đổ dữ liệu câu hỏi của Farmer (Tải thông tin profile động từ Supabase)
    let farmerName = "Thành viên";
    let farmerAvatar = 'https://i.pravatar.cc/150?u=' + req.user_id;

    if (window.supabaseClient && req.user_id) {
        try {
            const { data: pProfile } = await window.supabaseClient
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', req.user_id)
                .single();
            if (pProfile) {
                farmerName = pProfile.full_name || farmerName;
                farmerAvatar = pProfile.avatar_url || farmerAvatar;
            }
        } catch (pe) {
            console.error("Lỗi lấy thông tin người hỏi:", pe);
        }
    }

    // Tính thời gian hiển thị
    const createdDate = new Date(req.created_at);
    const diff = new Date() - createdDate;
    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    let timeStr = 'Vừa xong';
    if (diffDays > 0) timeStr = diffDays + ' ngày trước';
    else if (diffHours > 0) timeStr = diffHours + ' giờ trước';
    else if (diff > 60000) timeStr = Math.floor(diff / 60000) + ' phút trước';

    document.getElementById('ecm-farmer-avatar').src = farmerAvatar;
    document.getElementById('ecm-farmer-name').innerText = farmerName;
    document.getElementById('ecm-question-time').innerText = timeStr;
    document.getElementById('ecm-question-title').innerText = `Yêu cầu nhận diện ${req.ai_prediction || 'cây trồng'}`;
    document.getElementById('ecm-question-content').innerText = req.user_note || req.note || 'Không có ghi chú thêm.';

    const imgContainer = document.getElementById('ecm-question-image-container');
    const imgEl = document.getElementById('ecm-question-image');
    if (req.image_url) {
        imgEl.src = req.image_url;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.classList.add('hidden');
    }

    document.getElementById('ecm-crop-tag').innerText = '#' + (req.ai_prediction || 'NongNghiep').replace(/[\s_]+/g, '');

    const answerContainer = document.getElementById('ecm-answer-container');
    answerContainer.innerHTML = `
        <div class="flex items-center justify-center py-6 text-on-surface-variant animate-pulse gap-2">
            <span class="material-symbols-outlined animate-spin">autorenew</span>
            Đang tải phản hồi của chuyên gia...
        </div>
    `;

    try {
        const response = await fetch(`/api/expert-responses/${reqId}`);
        const responsesList = await response.json();

        if (responsesList && responsesList.length > 0) {
            const resp = responsesList[0];

            // Lấy profile của chuyên gia
            let expertName = "Chuyên gia AgriSocial";
            let expertAvatar = "https://i.pravatar.cc/150?u=expert";

            if (window.supabaseClient && resp.expert_id) {
                try {
                    const { data: expProfile } = await window.supabaseClient
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', resp.expert_id)
                        .single();
                    if (expProfile) {
                        expertName = expProfile.full_name || expertName;
                        expertAvatar = expProfile.avatar_url || expertAvatar;
                    }
                } catch (pe) {
                    console.error("Lỗi lấy thông tin chuyên gia:", pe);
                }
            }

<<<<<<< HEAD
            let isOwner = false;
            try {
                const userStr = localStorage.getItem('agrisocial_user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    isOwner = (user.id === req.user_id || user.sub === req.user_id);
                }
            } catch (e) {}

=======
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
            answerContainer.innerHTML = `
                <div class="bg-primary/5 border border-primary/10 rounded-2xl p-5 space-y-4">
                    <div class="flex items-center gap-3">
                        <img src="${expertAvatar}" class="w-10 h-10 rounded-full object-cover border border-primary/20" />
                        <div>
                            <h5 class="font-bold text-on-surface text-sm flex items-center gap-1.5">
                                ${expertName}
                                <span class="material-symbols-outlined text-[16px] text-primary fill">verified</span>
                            </h5>
                            <p class="text-xs text-on-surface-variant">Đã giải đáp</p>
                        </div>
                    </div>
                    
                    <div class="space-y-3 pt-2 border-t border-primary/10">
                        <div class="space-y-1">
                            <span class="text-[10px] font-black uppercase text-primary tracking-wider">Chẩn đoán:</span>
                            <p class="text-sm font-semibold text-on-surface break-words">${resp.diagnosis || 'Đang cập nhật...'}</p>
                        </div>
                        <div class="space-y-1">
                            <span class="text-[10px] font-black uppercase text-primary tracking-wider">Phác đồ điều trị & Khuyến nghị:</span>
                            <p class="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line break-words">${resp.treatment || 'Đang cập nhật...'}</p>
                        </div>
                        ${resp.notes ? `
                        <div class="space-y-1">
                            <span class="text-[10px] font-black uppercase text-primary tracking-wider">Lưu ý thêm:</span>
                            <p class="text-sm text-on-surface-variant leading-relaxed break-words">${resp.notes}</p>
                        </div>
                        ` : ''}
                        
<<<<<<< HEAD
                        ${isOwner ? `
=======
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
                        <!-- Rating System -->
                        <div class="mt-4 pt-4 border-t border-primary/10 flex flex-col items-center">
                            <p class="text-xs font-bold text-on-surface-variant mb-2">Bạn đánh giá phản hồi này thế nào?</p>
                            <div class="flex items-center gap-1" id="star-rating-${resp.id}">
                                ${[1, 2, 3, 4, 5].map(star => `
                                    <button onclick="rateExpertResponse('${resp.id}', ${star})" 
                                            class="star-btn p-1 transition-transform hover:scale-110 group ${resp.rating && resp.rating >= star ? 'rated' : ''}" 
                                            ${resp.rating ? 'disabled' : ''}
                                            data-rating="${star}">
                                        <svg class="w-8 h-8 transition-colors ${resp.rating && resp.rating >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-300 fill-transparent group-hover:text-amber-200 group-hover:fill-amber-200'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                        </svg>
                                    </button>
                                `).join('')}
                            </div>
                            ${resp.rating ? `<p class="text-[10px] text-emerald-600 font-bold mt-1">Cảm ơn bạn đã đánh giá!</p>` : ''}
                        </div>
<<<<<<< HEAD
                        ` : ''}
                    </div>

=======
                    </div>
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
                </div>
            `;
        } else {
            answerContainer.innerHTML = `
                <div class="bg-surface-container border border-outline-variant/30 rounded-2xl p-6 text-center text-on-surface-variant">
                    <span class="material-symbols-outlined text-4xl mb-2 text-outline-variant">pending</span>
                    <p class="font-bold text-sm text-on-surface">Yêu cầu chưa được trả lời</p>
                    <p class="text-xs mt-1 text-on-surface-variant/80">Câu hỏi này đang chờ các chuyên gia của AgriSocial tiếp nhận và phản hồi. Vui lòng kiểm tra lại sau!</p>
                </div>
            `;
        }
    } catch (err) {
        console.error("Lỗi lấy chi tiết phản hồi chuyên gia:", err);
        answerContainer.innerHTML = `
            <div class="p-5 text-center text-error font-medium">Lỗi kết nối khi tải phản hồi. Vui lòng thử lại!</div>
        `;
    }
};

window.closeExpertConsultationModal = function () {
    const modal = document.getElementById('expert-consultation-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
};

// Function to handle rating expert response
window.rateExpertResponse = async function (responseId, rating) {
    const token = localStorage.getItem('agrisocial_token');
    if (!token) {
        if (window.showToast) window.showToast('Vui lòng đăng nhập để đánh giá!', 'error');
        else alert('Vui lòng đăng nhập để đánh giá!');
        return;
    }

    // Cập nhật UI ngay lập tức để phản hồi nhanh
    const container = document.getElementById(`star-rating-${responseId}`);
    if (container) {
        const buttons = container.querySelectorAll('.star-btn');
        buttons.forEach((btn, index) => {
            const starValue = index + 1;
            const svg = btn.querySelector('svg');
            if (svg) {
                btn.disabled = true; // Khoá nút
                if (starValue <= rating) {
                    svg.classList.remove('text-slate-300', 'fill-transparent', 'group-hover:text-amber-200', 'group-hover:fill-amber-200');
                    svg.classList.add('text-amber-400', 'fill-amber-400');
                } else {
                    svg.classList.remove('text-amber-400', 'fill-amber-400');
                    svg.classList.add('text-slate-300', 'fill-transparent');
                }
            }
        });

        // Hiện lời cảm ơn nếu chưa có
        if (!container.nextElementSibling || !container.nextElementSibling.classList.contains('text-emerald-600')) {
            const thankYou = document.createElement('p');
            thankYou.className = "text-[10px] text-emerald-600 font-bold mt-1";
            thankYou.innerText = "Cảm ơn bạn đã đánh giá!";
            container.parentElement.appendChild(thankYou);
        }
    }

    try {
        const res = await fetch(`/api/expert-responses/${responseId}/rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ rating: rating })
        });
        const data = await res.json();

        if (data.success) {
            if (window.showToast) window.showToast('Đã ghi nhận đánh giá của bạn!', 'success');
        } else {
            if (window.showToast) window.showToast(data.error || 'Lỗi khi gửi đánh giá', 'error');
        }
    } catch (err) {
        console.error("Lỗi đánh giá:", err);
        if (window.showToast) window.showToast('Không thể kết nối đến máy chủ', 'error');
    }
};
