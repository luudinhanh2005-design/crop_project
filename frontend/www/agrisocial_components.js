/**
 * AgriSocial Components - FeedPost
 * Cung cấp UI và logic cho bài đăng có tích hợp AI
 */

const AgrisocialComponents = {
    renderFeedPost: function (post) {
        const {
            id, display_name, avatar_url, location = "", time_str = "vừa xong",
            caption, image_url, ai_data = null, likes = 0, comments_count = 0,
            crop_name = "NÔNG NGHIỆP"
        } = post;

        const avatarInitial = display_name ? display_name.charAt(0).toUpperCase() : "U";

        let aiBadgeHtml = '';
        if (ai_data) {
            aiBadgeHtml = `
                <div class="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-2xl mb-4 border border-green-100">
                    <span class="text-[#15803d] text-xs font-black">📊 PHÂN TÍCH: ${ai_data.prediction.toUpperCase()}</span>
                    <span class="text-neutral-400 text-[10px]">• Độ tin cậy: ${ai_data.confidence}</span>
                </div>
            `;
        }

        return `
            <div class="bg-white rounded-[2rem] border border-neutral-100 overflow-hidden mb-6 shadow-sm hover:shadow-md transition-all" id="post-${id}">
                <div class="p-6 flex items-center justify-between border-b border-neutral-50 bg-neutral-50/30">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-agrisocial-primary text-white flex items-center justify-center font-black shadow-lg shadow-agrisocial-primary/20">
                            ${avatar_url ? `<img src="${avatar_url}" class="w-full h-full rounded-2xl object-cover">` : avatarInitial}
                        </div>
                        <div>
                            <div class="flex items-center gap-1.5">
                                <h4 class="font-black text-neutral-800 text-sm">${display_name}</h4>
                                <span class="bg-blue-500 text-white text-[8px] p-0.5 rounded-full">✓</span>
                            </div>
                            <div class="flex items-center gap-1 text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                                <span>${time_str}</span>
                                <span>•</span>
                                <span class="text-agrisocial-primary">${crop_name.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                    <span class="text-[10px] font-black text-neutral-400 bg-white px-3 py-1 rounded-full border border-neutral-100">ID: #${String(id).slice(0, 5)}</span>
                </div>

                <div class="p-6">
                    ${aiBadgeHtml}
                    <div class="text-neutral-700 leading-relaxed text-[15px] font-medium mb-6">
                        ${caption.replace(/\n/g, '<br>')}
                    </div>
                    ${image_url ? `
                    <div class="rounded-3xl overflow-hidden mb-6 border border-neutral-100">
                        <img src="${image_url}" class="w-full object-cover max-h-[450px]" onerror="this.parentElement.style.display='none'">
                    </div>
                    ` : ''}
                    <div class="flex items-center justify-between pt-6 border-t border-neutral-50">
                        <div class="flex items-center gap-6">
                            <button onclick="toggleLike('${id}')" class="flex items-center gap-2 text-neutral-400 hover:text-agrisocial-primary transition-colors font-bold text-xs" id="like-btn-${id}">
                                <span class="text-xl like-status-span">👍</span> <span class="like-count-val">${likes}</span>
                            </button>
                            <button onclick="openCommentModal('${id}')" class="flex items-center gap-2 text-neutral-400 hover:text-agrisocial-primary transition-colors font-bold text-xs">
                                <span class="text-xl">💬</span> <span class="comment-count-val">${comments_count}</span>
                            </button>
                        </div>
                        <button onclick="sharePost('${id}')" class="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-400 hover:bg-neutral-100 transition-all">
                            <span>📤</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderNotificationItem: function (notif) {
        const actor = notif.actor_profiles || {};
        const userName = actor.full_name || notif.user_name || "Nhà nông";
        const avatarUrl = actor.avatar_url || notif.avatar_url;
        const type = notif.type;
        const isRead = notif.is_read || false;

        let timeStr = notif.time_str || "Vừa xong";
        if (notif.created_at) {
            const date = new Date(notif.created_at);
            timeStr = date.toLocaleDateString('vi-VN') + " " + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }

        let actionText = "", actionIcon = "", actionIconBg = "";
        switch (type) {
            case 'like': actionText = "đã thích bài viết của bạn"; actionIcon = "❤️"; actionIconBg = "bg-red-500"; break;
            case 'comment': actionText = "đã bình luận: \"" + (notif.comment_text || "") + "\""; actionIcon = "💬"; actionIconBg = "bg-blue-500"; break;
            case 'follow': actionText = "đã bắt đầu theo dõi bạn"; actionIcon = "👤"; actionIconBg = "bg-[#00B14F]"; break;
            case 'react': actionText = "đã bày tỏ cảm xúc về bài viết"; actionIcon = "✨"; actionIconBg = "bg-orange-500"; break;
            case 'login': actionText = "vừa đăng nhập vào hệ thống"; actionIcon = "🔐"; actionIconBg = "bg-blue-600"; break;
        }

        return `
            <div class="flex items-center gap-3 p-4 ${isRead ? 'bg-white' : 'bg-[#F0FDF4]'} hover:bg-neutral-50 border-b border-neutral-100 transition-colors cursor-pointer">
                <div class="relative">
                    <div class="w-12 h-12 rounded-full overflow-hidden bg-neutral-200 flex items-center justify-center text-white font-bold text-lg">
                        ${avatarUrl ? `<img src="${avatarUrl}" class="w-full h-full object-cover">` : userName.charAt(0)}
                    </div>
                    <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${actionIconBg} flex items-center justify-center text-[10px] text-white border-2 border-white shadow-sm">${actionIcon}</div>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-neutral-700 leading-snug"><span class="font-bold">${userName}</span> ${actionText}</p>
                    <p class="text-[11px] text-neutral-500 mt-1">${timeStr}</p>
                </div>
                ${notif.preview_url ? `<div class="w-12 h-12 rounded-lg overflow-hidden border border-neutral-200"><img src="${notif.preview_url}" class="w-full h-full object-cover"></div>` : ''}
            </div>
        `;
    },

    renderProfileHeader: function (user) {
        const crops = user.crops || ['Lúa gạo', 'Ngô'];
        const cropsHtml = crops.map(c => `<span class="bg-surface-container-high text-on-surface px-3 py-1 rounded-full font-label-md text-label-md border border-outline-variant/50">${c}</span>`).join('');

        return `
            <div class="bg-surface rounded-xl overflow-hidden shadow-[0_2px_10px_rgba(46,125,50,0.04)] border border-outline-variant/30">
                <!-- Cover Photo -->
                <div class="h-48 md:h-64 relative bg-surface-container-high overflow-hidden">
                    <img src="${user.cover_url || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'}" class="w-full h-full object-cover" alt="Cover" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    ${user.isSelf ? `<button onclick="document.getElementById('ep-cover-file')?.click(); openEditProfileModal();" class="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors backdrop-blur-sm"><span class="material-symbols-outlined text-[18px]">photo_camera</span></button>` : ''}
                </div>
                <!-- Profile Details -->
                <div class="px-6 pb-6 relative">
                    <!-- Avatar -->
                    <div class="absolute -top-16 left-6 rounded-full p-1 bg-surface">
                        <img src="${user.avatar_url}" class="w-32 h-32 rounded-full object-cover border-4 border-surface shadow-lg" alt="${user.full_name}" />
                        ${user.isSelf ? `<button onclick="document.getElementById('ep-avatar-file')?.click(); openEditProfileModal();" class="absolute bottom-1 right-1 bg-primary text-on-primary w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"><span class="material-symbols-outlined text-[16px]">photo_camera</span></button>` : ''}
                    </div>
                    <!-- Actions -->
                    <div class="flex justify-end pt-4 pb-2 gap-3">
                        ${user.isSelf
                            ? `<button onclick="openEditProfileModal()" class="rounded-full bg-primary text-on-primary px-6 py-2.5 font-label-lg text-label-lg hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
                                <span class="material-symbols-outlined text-[18px]">edit</span> Chỉnh sửa hồ sơ
                               </button>`
                            : `<button onclick="openChat('${user.id}', '${user.full_name.replace(/'/g, "\\'")}', '${user.avatar_url}')" class="rounded-full border-2 border-secondary text-secondary px-5 py-2 font-label-lg text-label-lg hover:bg-secondary/5 transition-colors flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-[18px]">chat</span> Nhắn tin
                               </button>
                               <button onclick="toggleFollow('${user.id}')" id="btn-follow-${user.id}" class="rounded-full bg-primary text-on-primary px-6 py-2.5 font-label-lg text-label-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm">
                                <span class="material-symbols-outlined text-[18px]">person_add</span> Theo dõi
                               </button>`
                        }
                    </div>
                    <!-- Info -->
                    <div class="mt-4">
                        <h1 class="font-headline-xl text-headline-xl text-on-surface flex items-center gap-2">
                            ${user.full_name}
                            ${user.role === 'expert' || user.role === 'admin' ? '<span class="material-symbols-outlined text-primary text-[22px]" style="font-variation-settings: \'FILL\' 1;">verified</span>' : ''}
                        </h1>
                        <p class="font-body-md text-body-md text-on-surface-variant mt-1">@${user.username}</p>
                        ${user.bio ? `<p class="font-body-lg text-body-lg text-on-surface mt-3">${user.bio}</p>` : ''}
                        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                            ${user.location ? `<p class="font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
                                <span class="material-symbols-outlined text-[18px]">location_on</span> ${user.location}
                            </p>` : ''}
                            <p class="font-body-md text-body-md text-tertiary flex items-center gap-1">
                                <span class="material-symbols-outlined text-[18px]">calendar_today</span> ${user.joined || 'Thành viên'}
                            </p>
                        </div>
                        ${cropsHtml ? `<div class="flex items-center gap-2 mt-4 flex-wrap">${cropsHtml}</div>` : ''}
                        <!-- Stats -->
                        <div class="flex gap-6 mt-6 pt-6 border-t border-outline-variant/30">
                            <div class="flex flex-col cursor-pointer hover:opacity-70 transition-opacity" onclick="switchProfileTab('posts')">
                                <span class="font-headline-md text-headline-md text-on-surface" id="prof-post-count">${user.stats?.posts || 0}</span>
                                <span class="font-body-md text-body-md text-on-surface-variant">Bài viết</span>
                            </div>
                            <div class="flex flex-col cursor-pointer hover:opacity-70 transition-opacity" onclick="switchProfileTab('followers')">
                                <span class="font-headline-md text-headline-md text-on-surface" id="prof-follower-count">${user.stats?.followers || 0}</span>
                                <span class="font-body-md text-body-md text-on-surface-variant">Người theo dõi</span>
                            </div>
                            <div class="flex flex-col cursor-pointer hover:opacity-70 transition-opacity" onclick="switchProfileTab('following')">
                                <span class="font-headline-md text-headline-md text-on-surface" id="prof-following-count">${user.stats?.following || 0}</span>
                                <span class="font-body-md text-body-md text-on-surface-variant">Đang theo dõi</span>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Tabs -->
                <div class="flex border-t border-outline-variant/30 px-2 overflow-x-auto">
                    <button onclick="switchProfileTab('posts')" id="tab-btn-posts" class="px-6 py-4 font-label-lg text-label-lg text-primary border-b-2 border-primary shrink-0 profile-tab-btn">Bài đăng</button>
                    <button onclick="switchProfileTab('garden')" id="tab-btn-garden" class="px-6 py-4 font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container-low transition-colors shrink-0 profile-tab-btn">Khu vườn</button>
                    <button onclick="switchProfileTab('about')" id="tab-btn-about" class="px-6 py-4 font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container-low transition-colors shrink-0 profile-tab-btn">Giới thiệu</button>
                    <button onclick="switchProfileTab('badges')" id="tab-btn-badges" class="px-6 py-4 font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container-low transition-colors shrink-0 profile-tab-btn">Huy hiệu</button>
                </div>
            </div>
        `;
    },

    renderProfileSidebar: function (user) {
        return `
            <!-- Expertise Level Card -->
            <div class="bg-surface rounded-xl p-5 shadow-[0_2px_10px_rgba(46,125,50,0.04)] border border-outline-variant/30">
                <h3 class="font-headline-md text-headline-md text-on-surface mb-4">Cấp độ chuyên môn</h3>
                <div class="flex items-center gap-4 bg-surface-container-low p-4 rounded-lg">
                    <div class="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
                        <span class="material-symbols-outlined text-[28px]" style="font-variation-settings: 'FILL' 1;">military_tech</span>
                    </div>
                    <div>
                        <p class="font-label-lg text-label-lg text-on-surface">${user.role === 'expert' ? 'Chuyên gia' : user.role === 'admin' ? 'Quản trị viên' : 'Nông dân Pro'}</p>
                        <p class="font-body-md text-body-md text-on-surface-variant text-[12px]">Top 5% đóng góp trong Cây lương thực</p>
                    </div>
                </div>
            </div>
            <!-- Top Crops Card -->
            <div class="bg-surface rounded-xl p-5 shadow-[0_2px_10px_rgba(46,125,50,0.04)] border border-outline-variant/30">
                <h3 class="font-headline-md text-headline-md text-on-surface mb-4">Cây trồng chính</h3>
                <div class="flex flex-col gap-3">
                    <div class="flex justify-between items-center">
                        <span class="font-body-md text-body-md text-on-surface flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary text-[20px]">grass</span> Lúa
                        </span>
                        <span class="bg-primary-container text-on-primary-container px-2 py-0.5 rounded text-[12px] font-bold">85%</span>
                    </div>
                    <div class="w-full bg-surface-container-high rounded-full h-2">
                        <div class="bg-primary h-2 rounded-full transition-all" style="width: 85%"></div>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <span class="font-body-md text-body-md text-on-surface flex items-center gap-2">
                            <span class="material-symbols-outlined text-secondary text-[20px]">eco</span> Ngô
                        </span>
                        <span class="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-[12px] font-bold">15%</span>
                    </div>
                    <div class="w-full bg-surface-container-high rounded-full h-2">
                        <div class="bg-secondary h-2 rounded-full transition-all" style="width: 15%"></div>
                    </div>
                </div>
            </div>
            <!-- Recent Activity Card -->
            <div class="bg-surface rounded-xl p-5 shadow-[0_2px_10px_rgba(46,125,50,0.04)] border border-outline-variant/30">
                <h3 class="font-headline-md text-headline-md text-on-surface mb-4">Hoạt động gần đây</h3>
                <div class="flex flex-col gap-4" id="profile-recent-activity">
                    <div class="flex gap-3">
                        <div class="mt-0.5"><span class="material-symbols-outlined text-tertiary text-[18px]">forum</span></div>
                        <div>
                            <p class="font-body-md text-body-md text-on-surface">Bình luận về <span class="font-label-lg text-label-lg">Chiến lược phòng trừ sâu bệnh</span></p>
                            <p class="font-body-md text-body-md text-on-surface-variant text-[12px] mt-0.5">3 giờ trước</p>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <div class="mt-0.5"><span class="material-symbols-outlined text-tertiary text-[18px]">thumb_up</span></div>
                        <div>
                            <p class="font-body-md text-body-md text-on-surface">Thích bài viết của <span class="font-label-lg text-label-lg">Trần Thị B</span></p>
                            <p class="font-body-md text-body-md text-on-surface-variant text-[12px] mt-0.5">Hôm qua</p>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <div class="mt-0.5"><span class="material-symbols-outlined text-tertiary text-[18px]">group_add</span></div>
                        <div>
                            <p class="font-body-md text-body-md text-on-surface">Tham gia nhóm <span class="font-label-lg text-label-lg">Phân bón hữu cơ</span></p>
                            <p class="font-body-md text-body-md text-on-surface-variant text-[12px] mt-0.5">3 ngày trước</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderTrendingItem: function (crop, rank) {
        return `
            <div class="flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-2xl transition-all cursor-pointer group">
                <div class="w-12 h-12 rounded-2xl ${crop.color || 'bg-orange-100'} flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-sm">${crop.icon}</div>
                <div class="flex-1">
                    <h4 class="font-bold text-sm text-neutral-700">${crop.name}</h4>
                    <p class="text-[11px] text-neutral-500">${crop.post_count} bài đăng</p>
                </div>
                <div class="text-neutral-300 font-black text-sm italic group-hover:text-agrisocial-primary">#${rank}</div>
            </div>
        `;
    },

    renderExplorePage: function (articles, activeCategory = "Tất cả") {
        const categories = ["Tất cả", "Lúa gạo", "Cây lương thực", "Đất trồng", "Rau quả", "Kỹ thuật"];
        const featured = articles[0] || null;
        const gridArticles = articles.slice(1);

        return `
            <div class="explore-page animate-fade-in p-4 sm:p-8 max-w-6xl mx-auto">
                <header class="mb-10 text-center">
                    <h1 class="text-3xl font-black text-neutral-800 mb-2">CƠ SỞ DỮ LIỆU NÔNG NGHIỆP</h1>
                    <p class="text-neutral-500 font-medium italic">Hệ thống tổng hợp tri thức và số liệu kỹ thuật chuyên sâu</p>
                </header>
                <div class="flex gap-2 overflow-x-auto pb-6 no-scrollbar mb-8 justify-center">
                    ${categories.map(cat => `<button onclick="switchExploreCategory('${cat}')" class="px-6 py-2.5 rounded-2xl text-sm font-black whitespace-nowrap ${activeCategory === cat ? 'bg-agrisocial-primary text-white shadow-lg' : 'bg-white text-neutral-500 hover:bg-neutral-50 border border-neutral-100'}">${cat.toUpperCase()}</button>`).join('')}
                </div>
                ${featured ? `
                <section class="mb-12">
                    <div class="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-[2.5rem] p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden cursor-pointer hover:scale-[1.01] transition-transform" onclick="openArticleDetail('${featured.id}')">
                        <div class="relative z-10">
                            <span class="bg-agrisocial-primary text-[10px] font-black px-3 py-1 rounded-full uppercase mb-6 inline-block tracking-widest">BÁO CÁO TIÊU ĐIỂM</span>
                            <h2 class="text-2xl sm:text-4xl font-black mb-6 leading-tight max-w-2xl">${featured.title}</h2>
                            <p class="text-neutral-300 text-lg leading-relaxed mb-8 max-w-xl line-clamp-3">${featured.summary}</p>
                            <div class="flex items-center gap-4">
                                <button class="bg-white text-neutral-900 px-8 py-3 rounded-2xl font-black text-sm">XEM CHI TIẾT</button>
                                <span class="text-neutral-400 text-sm font-bold">${featured.time_ago} • CHUYÊN GIA: ${featured.author.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </section>` : ''}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    ${gridArticles.map(article => `
                        <div class="bg-white border border-neutral-100 p-8 rounded-[2rem] hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between" onclick="openArticleDetail('${article.id}')">
                            <div>
                                <div class="flex items-center justify-between mb-6">
                                    <span class="text-[10px] font-black text-agrisocial-primary bg-green-50 px-3 py-1 rounded-full uppercase tracking-tighter">${article.category}</span>
                                    <span class="text-[10px] text-neutral-400 font-bold">${article.time_ago}</span>
                                </div>
                                <h3 class="text-xl font-black text-neutral-800 mb-4 leading-snug hover:text-agrisocial-primary transition-colors">${article.title}</h3>
                                <p class="text-neutral-500 text-sm leading-relaxed line-clamp-3 mb-6">${article.summary}</p>
                            </div>
                            <div class="pt-6 border-t border-neutral-50 flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center font-black text-xs text-neutral-400">${article.author.charAt(0).toUpperCase()}</div>
                                    <span class="text-xs font-bold text-neutral-600">${article.author}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    renderFollowerItem: function (profile, isFollowing = false) {
        return `
            <div class="bg-surface rounded-xl border border-outline-variant/30 shadow-sm p-5 flex items-center justify-between hover:shadow-[0_4px_16px_rgba(46,125,50,0.06)] transition-shadow">
                <div class="flex items-center gap-4 cursor-pointer" onclick="window.targetProfileId='${profile.id}'; renderProfilePage();">
                    <img src="${profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'U')}&background=0d631b&color=fff`}" class="w-14 h-14 rounded-full object-cover" alt="${profile.full_name}" />
                    <div>
                        <h4 class="font-label-lg text-label-lg text-on-surface">${profile.full_name}</h4>
                        <p class="font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
                            <span class="material-symbols-outlined text-sm">location_on</span> ${profile.farm_location || profile.location || 'Nông dân'}
                        </p>
                        ${profile.main_crop ? `
                        <div class="mt-1 flex gap-2">
                            <span class="bg-tertiary-fixed text-on-tertiary-fixed font-label-md text-[10px] px-2 py-0.5 rounded-full uppercase">${profile.main_crop}</span>
                        </div>` : ''}
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="border-2 border-secondary text-secondary font-label-md text-label-md px-4 py-1.5 rounded-full hover:bg-secondary/10 transition-colors hidden sm:block">
                        Nhắn tin
                    </button>
                    ${(currentUser && currentUser.id !== profile.id) ? `
                    <button onclick="toggleFollow('${profile.id}')" id="btn-follow-list-${profile.id}" class="px-5 py-2 rounded-full font-label-md text-label-md transition-colors shadow-sm ${isFollowing ? 'bg-surface-container-highest text-on-surface-variant' : 'bg-primary text-on-primary hover:bg-primary/90'}">
                        ${isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                    </button>` : ''}
                </div>
            </div>
        `;
    },
};

window.AgrisocialComponents = AgrisocialComponents;