// --- CONFIG ---
const SUPABASE_URL = "https://rsjiaxbvlnslmtollozg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzamlheGJ2bG5zbG10b2xsb3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTg1NjcsImV4cCI6MjA5MjQzNDU2N30.vl13Y4ZiVd6p2j2zdIEQbyS0Lk5V0OFiJ0AQLHLxK_c";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let scanHistory = [];
let currentResult = null;
let stream = null;
let cropChartInstance = null;

// DOM Elements
let btnCamera, btnCapture, fileUpload, video, imgPreview, heatmapImg, canvas, scannerBox, radarAnim, overlay, placeholder, dynEncyc, placeholderEncyc;

// --- KHỞI TẠO ỨNG DỤNG ---
function init() {
    console.log("App initializing...");

    // Gán các phần tử DOM
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

    initAuth();
    checkUser();
    fetchHistory();
    setupEventListeners();
    setupAdvancedFeatures();
    setupBottomNav();

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

    // Auto-load community feed
    fetchCommunityFeed();
    setupProfileTabs();
    
    // Check for broadcast
    loadBroadcast();
    // Poll every 30 seconds
    setInterval(loadBroadcast, 30000);
}

function setupProfileTabs() {
    document.querySelectorAll('.p-tab').forEach(tab => {
        tab.onclick = () => {
            const target = tab.getAttribute('data-ptab');
            document.querySelectorAll('.p-pane').forEach(p => p.style.display = 'none');
            document.querySelectorAll('.p-tab').forEach(t => t.classList.remove('active'));
            
            const pane = document.getElementById(target);
            if (pane) pane.style.display = 'block';
            tab.classList.add('active');
        };
    });

    const btnEditProfile = document.getElementById('btn-edit-profile');
    const epModal = document.getElementById('edit-profile-modal');
    
    if (btnEditProfile && epModal) {
        btnEditProfile.onclick = () => {
            // Fill current data
            document.getElementById('ep-name').value = document.getElementById('profile-name').innerText;
            document.getElementById('ep-bio').value = document.getElementById('profile-bio').innerText;
            document.getElementById('ep-avatar-url').value = '';
            document.getElementById('ep-cover-url').value = '';
            epModal.style.display = 'flex';
        };
    }

    const btnCloseEP = document.getElementById('btn-close-ep');
    const btnCancelEP = document.getElementById('btn-cancel-ep');
    const btnSaveEP = document.getElementById('btn-save-ep');

    if (btnCloseEP) btnCloseEP.onclick = () => epModal.style.display = 'none';
    if (btnCancelEP) btnCancelEP.onclick = () => epModal.style.display = 'none';
    
    if (btnSaveEP) {
        btnSaveEP.onclick = async () => {
            if (!currentUser) return;
            const newName = document.getElementById('ep-name').value;
            const newBio = document.getElementById('ep-bio').value;
            const newAvatar = document.getElementById('ep-avatar-url').value;
            const newCover = document.getElementById('ep-cover-url').value;

            try {
                const { error } = await supabaseClient.from('profiles').upsert({
                    id: currentUser.id,
                    full_name: newName,
                    bio: newBio,
                    avatar_url: newAvatar || undefined,
                    cover_url: newCover || undefined,
                    updated_at: new Date()
                });

                if (error) throw error;

                if (newName) document.getElementById('profile-name').innerText = newName;
                if (newBio) document.getElementById('profile-bio').innerText = newBio;
                if (newAvatar) {
                    document.getElementById('profile-avatar').innerHTML = `<img src="${newAvatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                }
                if (newCover) document.getElementById('profile-cover-img').src = newCover;

                showToast("Đã cập nhật hồ sơ thành công!", "success");
                epModal.style.display = 'none';
                
                // Tải lại feed để cập nhật avatar/tên mới trên các bài đăng cũ
                fetchCommunityFeed();
            } catch (e) {
                showToast("Lỗi khi cập nhật hồ sơ: " + e.message, "error");
            }
        };
    }

    // Reuse existing avatar/cover edit buttons to open modal too
    const btnEditAvatar = document.querySelector('.btn-edit-avatar');
    if (btnEditAvatar) btnEditAvatar.onclick = () => btnEditProfile.click();

    const btnEditCover = document.querySelector('.btn-edit-cover');
    if (btnEditCover) btnEditCover.onclick = () => btnEditProfile.click();
}

// Hàm tải bài viết của riêng user này vào profile
async function loadUserPostsToProfile() {
    if (!currentUser) return;
    const grid = document.getElementById('profile-posts-display');
    if (!grid) return;

    try {
        const res = await fetch(`/api/community/posts?email=${currentUser.email}`);
        const posts = await res.json();

        if (posts.length > 0) {
            grid.innerHTML = '';
            posts.forEach(post => {
                const thumb = document.createElement('div');
                thumb.className = 'profile-post-thumb';
                thumb.onclick = () => {
                    // Mở tab cộng đồng và cuộn đến bài viết? Hoặc xem chi tiết.
                    // Tạm thời chỉ thông báo
                    showToast("Đang xem chi tiết bài viết...", "info");
                };
                thumb.innerHTML = `<img src="${post.image_url}" alt="post">`;
                grid.appendChild(thumb);
            });
        }
    } catch (e) {
        console.error("Lỗi tải bài viết cá nhân:", e);
    }
}

// Cập nhật lại hàm updateProfileStats để gọi loadUserPostsToProfile
const originalUpdateProfileStats = updateProfileStats;
updateProfileStats = async function() {
    await originalUpdateProfileStats();
    loadUserPostsToProfile();
};

document.addEventListener('DOMContentLoaded', init);


// --- UTILS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-text">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        toast.style.transition = 'all 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

window.togglePassword = function(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    const btn = input.nextElementSibling;
    if (btn && btn.classList.contains('toggle-pass')) {
        btn.innerText = input.type === 'password' ? '👁️' : '🙈';
    }
};

// --- AUTH LOGIC ---
async function checkUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        currentUser = user;
        // Fetch extended profile từ bảng profiles
        const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
        if (profile) {
            currentUser.profile = profile;
        }
        updateAuthUI(currentUser);
        fetchHistory(); 
        updateProfileStats();
    } else {
        updateAuthUI(null);
    }
}

function updateAuthUI(user) {
    const btnNavLogin = document.getElementById('btn-login');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileBio = document.getElementById('profile-bio');
    const profileCover = document.getElementById('profile-cover-img');

    if (user) {
        const profile = user.profile || {};
        const metadata = user.user_metadata || {};
        const displayName = profile.full_name || metadata.full_name || user.email.split('@')[0];
        
        if (btnNavLogin) { btnNavLogin.innerText = 'Đã đăng nhập'; btnNavLogin.style.display = 'none'; }
        if (profileName) profileName.innerText = displayName;
        if (profileEmail) profileEmail.innerText = user.email;
        if (profileBio && profile.bio) profileBio.innerText = profile.bio;
        if (profileCover && profile.cover_url) profileCover.src = profile.cover_url;

        if (profileAvatar) {
            if (profile.avatar_url) {
                profileAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                profileAvatar.innerText = displayName.charAt(0).toUpperCase();
                profileAvatar.innerHTML = displayName.charAt(0).toUpperCase();
            }
        }

        const btnLogout = document.getElementById('btn-logout-drop');
        if (btnLogout) btnLogout.style.display = 'flex';

        // Check Role for UI elements
        const role = profile.role || 'user';
        console.log("Current User Role:", role); // DEBUG
        
        // Hiển thị role dưới email để kiểm tra
        if (profileEmail) {
            profileEmail.innerHTML = `${user.email} <br><span style="color: #8b5cf6; font-weight: bold;">[Quyền: ${role.toUpperCase()}]</span>`;
        }

        const btnExpert = document.getElementById('btn-feature-expert');
        const btnAdmin = document.getElementById('btn-feature-admin');
        
        if (role === 'expert' || role === 'admin') {
            if (btnExpert) btnExpert.style.display = 'flex';
        } else {
            if (btnExpert) btnExpert.style.display = 'none';
        }
        
        if (role === 'admin') {
            console.log("Showing Admin Button..."); // DEBUG
            if (btnAdmin) btnAdmin.style.display = 'flex';
        } else {
            if (btnAdmin) btnAdmin.style.display = 'none';
        }
        
    } else {
        currentUser = null;
        if (btnNavLogin) { btnNavLogin.innerText = 'Đăng nhập / Đăng ký'; btnNavLogin.style.display = 'inline-block'; }
        if (profileName) profileName.innerText = 'Nhà Nông Ẩn Danh';
        if (profileEmail) profileEmail.innerText = 'Chưa đăng nhập';
        if (profileAvatar) profileAvatar.innerText = 'N';
        
        // Reset stats for anonymous
        const profScan = document.getElementById('prof-scan-count');
        const profGarden = document.getElementById('prof-garden-count');
        const profPost = document.getElementById('prof-post-count');
        const profFriend = document.getElementById('prof-friend-count');
        if (profScan) profScan.innerText = '0';
        if (profGarden) profGarden.innerText = '0';
        if (profPost) profPost.innerText = '0';
        if (profFriend) profFriend.innerText = '0';

        // Hide logout button
        const btnLogout = document.getElementById('btn-logout-drop');
        if (btnLogout) btnLogout.style.display = 'none';
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    alert("Đã đăng xuất");
    location.reload();
}

function initAuth() {
    const authModal = document.getElementById('auth-modal');
    const btnNavLogin = document.getElementById('btn-login');
    const btnCloseModal = document.querySelector('.close-modal');
    const authForm = document.getElementById('auth-form');
    const authSwitchLink = document.getElementById('auth-switch-link');

    let isLoginMode = true;

    if (btnNavLogin) btnNavLogin.onclick = () => authModal.style.display = 'flex';
    if (btnCloseModal) btnCloseModal.onclick = () => authModal.style.display = 'none';

    // Click ra ngoài để đóng modal
    authModal.onclick = (e) => {
        if (e.target === authModal) authModal.style.display = 'none';
    };

    // Event delegation for drop buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-drop-login')) {
            isLoginMode = true;
            updateAuthModalUI(isLoginMode);
            authModal.style.display = 'flex';
        }
        if (e.target.classList.contains('btn-drop-register')) {
            isLoginMode = false;
            updateAuthModalUI(isLoginMode);
            authModal.style.display = 'flex';
        }
    });

    if (authSwitchLink) {
        authSwitchLink.onclick = (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            updateAuthModalUI(isLoginMode);
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
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const btnSubmit = document.getElementById('btn-auth-submit');

            btnSubmit.disabled = true;
            btnSubmit.innerText = "Đang xử lý...";

            try {
                if (isLoginMode) {
                    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                    showToast("Đăng nhập thành công!", "success");
                    authModal.style.display = 'none';
                    checkUser();
                } else {
                    const lastName = document.getElementById('auth-lastname').value;
                    const firstName = document.getElementById('auth-firstname').value;
                    const confirmPassword = document.getElementById('auth-confirm-password').value;
                    
                    if (password !== confirmPassword) {
                        showToast("Mật khẩu xác nhận không khớp!", "error");
                        return;
                    }

                    const fullName = `${lastName} ${firstName}`.trim();

                    const { error } = await supabaseClient.auth.signUp({ 
                        email, 
                        password,
                        options: {
                            data: {
                                full_name: fullName
                            }
                        }
                    });
                    if (error) throw error;
                    showToast("Đăng ký thành công! Hãy kiểm tra email để xác thực.", "success");
                    isLoginMode = true;
                    updateAuthModalUI(isLoginMode);
                }
            } catch (err) { showToast(err.message, "error"); }
            finally {
                btnSubmit.disabled = false;
                btnSubmit.innerText = isLoginMode ? "ĐĂNG NHẬP" : "ĐĂNG KÝ";
            }
        };
    }

    // Social Login
    const btnGoogle = document.getElementById('btn-google-login');
    const btnFacebook = document.getElementById('btn-facebook-login');

    if (btnGoogle) {
        btnGoogle.onclick = async () => {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) showToast("Lỗi đăng nhập Google: " + error.message, "error");
        };
    }

    if (btnFacebook) {
        btnFacebook.onclick = async () => {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'facebook',
                options: { redirectTo: window.location.origin }
            });
            if (error) showToast("Lỗi đăng nhập Facebook: " + error.message, "error");
        };
    }

    // Logout
    const btnLogout = document.getElementById('btn-logout-drop');
    if (btnLogout) {
        btnLogout.onclick = async () => {
            await supabaseClient.auth.signOut();
            showToast("Đã đăng xuất", "info");
            setTimeout(() => location.reload(), 1000);
        };
    }

    // Forgot Password
    const btnForgot = document.getElementById('btn-forgot-pass');
    if (btnForgot) {
        btnForgot.onclick = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            if (!email) { showToast("Vui lòng nhập email để đặt lại mật khẩu!", "error"); return; }
            try {
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/reset-password.html',
                });
                if (error) throw error;
                showToast("Đã gửi link đặt lại mật khẩu! Kiểm tra email của bạn.", "success");
            } catch (err) { showToast(err.message, "error"); }
        };
    }

    // Edit Profile Logic
    const btnEditProfile = document.getElementById('btn-edit-profile');
    const epModal = document.getElementById('edit-profile-modal');
    const btnCloseEp = document.getElementById('btn-close-ep');
    const btnCancelEp = document.getElementById('btn-cancel-ep');
    const btnSaveEp = document.getElementById('btn-save-ep');

    if (btnEditProfile) {
        btnEditProfile.onclick = () => {
            if (!currentUser) return;
            const p = currentUser.profile || {};
            const m = currentUser.user_metadata || {};
            document.getElementById('ep-name').value = p.full_name || m.full_name || '';
            document.getElementById('ep-bio').value = p.bio || '';
            document.getElementById('ep-avatar-url').value = p.avatar_url || '';
            document.getElementById('ep-cover-url').value = p.cover_url || '';
            document.getElementById('ep-farm-location').value = p.farm_location || '';
            document.getElementById('ep-farm-area').value = p.farm_area || '';
            document.getElementById('ep-main-crop').value = p.main_crop || '';
            document.getElementById('ep-phone').value = p.phone || '';
            epModal.style.display = 'flex';
        };
    }

    if (btnCloseEp) btnCloseEp.onclick = () => epModal.style.display = 'none';
    if (btnCancelEp) btnCancelEp.onclick = () => epModal.style.display = 'none';

    if (btnSaveEp) {
        btnSaveEp.onclick = async () => {
            if (!currentUser) return;
            const full_name = document.getElementById('ep-name').value;
            const bio = document.getElementById('ep-bio').value;
            const avatar_url = document.getElementById('ep-avatar-url').value;
            const cover_url = document.getElementById('ep-cover-url').value;
            const farm_location = document.getElementById('ep-farm-location').value;
            const farm_area = parseFloat(document.getElementById('ep-farm-area').value) || 0;
            const main_crop = document.getElementById('ep-main-crop').value;
            const phone = document.getElementById('ep-phone').value;

            btnSaveEp.innerText = "Đang lưu...";
            btnSaveEp.disabled = true;

            try {
                // Update via API route
                const res = await fetch('/api/profile/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: currentUser.id, full_name, bio, avatar_url, cover_url, farm_location, farm_area, main_crop, phone })
                });
                const data = await res.json();
                
                // Also update local Supabase profile state so we don't need a hard reload immediately
                const { error } = await supabaseClient.from('profiles').update({
                    full_name, bio, avatar_url, cover_url, farm_location, farm_area, main_crop, phone
                }).eq('id', currentUser.id);

                if (error) throw error;
                showToast("Cập nhật hồ sơ thành công!", "success");
                epModal.style.display = 'none';
                checkUser(); // Refresh UI
            } catch (err) {
                showToast("Lỗi: " + err.message, "error");
            } finally {
                btnSaveEp.innerText = "Lưu thay đổi";
                btnSaveEp.disabled = false;
            }
        };
    }
}

// --- AUDIO Engine ---
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

// --- EVENT LISTENERS (MAIN) ---
function setupEventListeners() {
    if (btnCamera) {
        btnCamera.addEventListener('click', async () => {
            if (!currentUser) {
                showToast("Vui lòng đăng nhập để sử dụng tính năng quét cây!", "info");
                document.getElementById('auth-modal').style.display = 'flex';
                return;
            }
            initAudio();
            try {
                if (stream) { stopCamera(); return; }
                playTone(300, 'square', 0.1);
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                } catch(e) {
                    // Fallback cho PC/Laptop không có camera sau
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                }
                video.srcObject = stream; video.style.display = 'block';
                imgPreview.style.display = 'none'; heatmapImg.style.display = 'none';
                if (radarAnim) radarAnim.style.display = 'none';
                if (placeholder) placeholder.style.display = 'none';
                const placeholderLabel = document.getElementById('placeholder-label');
                if (placeholderLabel) placeholderLabel.style.display = 'none';
                btnCamera.innerHTML = '🛑 Tắt Camera';
                if (btnCapture) btnCapture.style.display = 'inline-flex';
                scannerBox.classList.add('active');
            } catch (err) { 
                console.error("Camera error:", err);
                alert("Lỗi Camera. Vui lòng kiểm tra lại quyền truy cập hoặc máy tính của bạn không có Webcam."); 
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
                analyzeImage(blob, url);
            }, 'image/jpeg', 0.9);
        });
    }

    if (fileUpload) {
        fileUpload.addEventListener('change', (e) => {
            if (!currentUser) {
                showToast("Vui lòng đăng nhập để sử dụng tính năng tải ảnh nhận diện!", "info");
                document.getElementById('auth-modal').style.display = 'flex';
                e.target.value = ''; // Reset file input
                return;
            }
            initAudio();
            const file = e.target.files[0];
            if (!file) return;
            stopCamera();
            const url = URL.createObjectURL(file);
            imgPreview.src = url; imgPreview.style.display = 'block';
            heatmapImg.style.display = 'none';
            if (radarAnim) radarAnim.style.display = 'none';
            if (placeholder) placeholder.style.display = 'none';
            const pl = document.getElementById('placeholder-label');
            if (pl) pl.style.display = 'none';
            analyzeImage(file, url);
        });
    }

    const btnClear = document.getElementById('btn-clear-history');
    if (btnClear) {
        btnClear.onclick = async () => {
            if (!currentUser) return;
            if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử quét? Hành động này không thể hoàn tác.")) {
                try {
                    const res = await fetch(`/api/history?user_id=${currentUser.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        scanHistory = [];
                        renderHistory();
                        updateProfileStats();
                        showToast("Đã xóa sạch lịch sử!", "success");
                    }
                } catch (e) { showToast("Lỗi khi xóa lịch sử", "error"); }
            }
        };
    }
}

function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video) video.style.display = 'none';
    if (radarAnim) radarAnim.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    if (btnCamera) {
        btnCamera.innerHTML = '<span class="icon">📷</span> Bật Camera';
        btnCapture.style.display = 'none';
    }
    if (scannerBox) scannerBox.classList.remove('active');
}

// --- ADVANCED FEATURES (Dashboard, Chat, Compare) ---
function setupAdvancedFeatures() {
    // 1. Dashboard
    const btnDashboard = document.getElementById('btn-dashboard');
    const modalDashboard = document.getElementById('modal-dashboard');
    const btnCloseDash = document.getElementById('btn-close-modal');

    if (btnDashboard) {
        btnDashboard.onclick = () => {
            modalDashboard.style.display = 'flex';
            renderChart();
            renderSummary();
            const reportDate = document.getElementById('report-date');
            if (reportDate) reportDate.innerText = `Ngày báo cáo: ${new Date().toLocaleDateString('vi-VN')}`;
        };
    }
    if (btnCloseDash) btnCloseDash.onclick = () => modalDashboard.style.display = 'none';

    modalDashboard.onclick = (e) => {
        if (e.target === modalDashboard) modalDashboard.style.display = 'none';
    };

    // 2. Export PDF
    const btnExport = document.getElementById('btn-export-pdf');
    if (btnExport) {
        btnExport.onclick = () => {
            const element = document.getElementById('pdf-report-content');
            const options = { margin: 10, filename: 'BaoCao_CayTrong.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
            html2pdf().set(options).from(element).save();
        };
    }

    // 3. AI Chat
    const btnToggleChat = document.getElementById('btn-toggle-chat');
    const chatWindow = document.getElementById('chat-window');
    const btnCloseChat = document.getElementById('btn-close-chat');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatInput = document.getElementById('chat-textarea');

    if (btnToggleChat) {
        btnToggleChat.onclick = () => {
            chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
        };
    }
    if (btnCloseChat) btnCloseChat.onclick = () => chatWindow.style.display = 'none';
    if (btnSendChat) btnSendChat.onclick = handleChat;
    if (chatInput) chatInput.onkeypress = (e) => { if (e.key === 'Enter') handleChat(); };

    // 4. Comparison — Premium Version
    const btnCompare = document.getElementById('btn-open-compare');
    const modalCompare = document.getElementById('compare-modal');
    const btnCloseCompare = document.getElementById('btn-close-compare');

    if (btnCompare) {
        btnCompare.onclick = () => {
            if (!currentResult) { alert("Hãy chọn hoặc quét một loại cây trước."); return; }
            renderCompareModal(currentResult);
            modalCompare.style.display = 'flex';
        };
    }

    if (btnCloseCompare) {
        btnCloseCompare.onclick = () => modalCompare.style.display = 'none';
    }

    if (modalCompare) {
        modalCompare.onclick = (e) => {
            if (e.target === modalCompare) modalCompare.style.display = 'none';
        };
    }

    // 5. Treatment Close
    const btnCloseTreat = document.getElementById('btn-close-treat');
    const modalTreat = document.getElementById('treat-modal');
    if (btnCloseTreat) btnCloseTreat.onclick = () => modalTreat.style.display = 'none';

    if (modalTreat) {
        modalTreat.onclick = (e) => {
            if (e.target === modalTreat) modalTreat.style.display = 'none';
        }
    }
}

function handleChat() {
    const input = document.getElementById('chat-textarea');
    const container = document.getElementById('chat-messages');
    if (!input.value.trim()) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'msg user';
    userMsg.innerText = input.value;
    container.appendChild(userMsg);

    const botMsg = document.createElement('div');
    botMsg.className = 'msg bot';
    botMsg.innerText = "Tôi đang phân tích câu hỏi của bạn về " + (currentResult ? currentResult.prediction : "loại cây này") + "...";
    container.appendChild(botMsg);

    input.value = '';
    container.scrollTop = container.scrollHeight;
}

function renderChart() {
    const ctx = document.getElementById('cropChart');
    if (!ctx) return;
    const stats = {};
    scanHistory.forEach(h => { stats[h.prediction] = (stats[h.prediction] || 0) + 1; });

    if (cropChartInstance) cropChartInstance.destroy();
    cropChartInstance = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: Object.keys(stats).map(k => k.toUpperCase()),
            datasets: [{
                data: Object.values(stats),
                backgroundColor: ['#00d2ff', '#10b981', '#ef4444', '#f59e0b']
            }]
        },
        options: { plugins: { legend: { labels: { color: '#fff' } } } }
    });
}

function renderSummary() {
    const list = document.getElementById('summary-list');
    if (!list) return;
    const stats = {};
    scanHistory.forEach(h => { stats[h.prediction] = (stats[h.prediction] || 0) + 1; });
    list.innerHTML = Object.keys(stats).map(k => `<li><span>${k.toUpperCase()}</span>: <strong>${stats[k]} mẫu</strong></li>`).join('');
}

function getHealthyImg(pred) {
    const cropType = pred.split('_')[0]; // Lấy phần đầu ví dụ 'rice' từ 'rice_leaf'
    const baseUrl = "./assets/healthy/";
    
    const mapping = {
        'rice': 'rice_healthy.png',
        'corn': 'corn_healthy.png',
        'wheat': 'wheat_healthy.png',
        'soybean': 'soybean_healthy.png',
        'sugarcane': 'sugarcane_healthy.png',
        'sweet_potato': 'sweet_potato_healthy.png',
        'cassava': 'cassava_healthy.png',
        'potato': 'potato_healthy.png'
    };

    return mapping[cropType] ? baseUrl + mapping[cropType] : baseUrl + 'rice_healthy.png';
}

function getDiseaseImg(pred) {
    const map = {
        'rice':        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Rice_blast.jpg/320px-Rice_blast.jpg',
        'corn':        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Corn_smut_fungus.jpg/320px-Corn_smut_fungus.jpg',
        'wheat':       'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Wheat_stripe_rust.jpg/320px-Wheat_stripe_rust.jpg',
        'soybean':     'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Soybean_rust.jpg/320px-Soybean_rust.jpg',
        'sugarcane':   'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Sugarcane_red_rot.jpg/320px-Sugarcane_red_rot.jpg',
        'cassava':     'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Cassava_brown_streak.jpg/320px-Cassava_brown_streak.jpg',
        'potato':      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Late_blight_on_potato.jpg/320px-Late_blight_on_potato.jpg',
        'sweet_potato':'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=320&q=80',
    };
    const cropType = pred.split('_')[0];
    const key = pred.startsWith('sweet_potato') ? 'sweet_potato' : cropType;
    return map[key] || map['rice'];
}

function getCompareData(pred) {
    const base = {
        rice: {
            viName: 'Lúa nước',
            tableRows: [
                { label: 'Màu lá',      ok: '🟢 Xanh đậm',     bad: '🟡 Vàng / nâu' },
                { label: 'Đốm / vết',   ok: '✅ Không có',      bad: '❌ Đốm nâu/xám' },
                { label: 'Hình dạng',   ok: '📏 Thẳng, mọng',  bad: '📉 Nhăn, cong' },
                { label: 'Thân cây',    ok: '💪 Cứng, đứng',   bad: '🥀 Mềm, héo' },
                { label: 'Bông lúa',    ok: '🌾 Chắc hạt',     bad: '🍂 Lép, rỗng' },
            ],
            checks: ['✅ Lá xanh đều, không đốm → Khỏe', '⚠️ Đốm hình thoi màu nâu → Đạo ôn', '⚠️ Lá cháy đầu từ mép → Bạc lá', '🚨 Thân mềm, thối gốc → Sâu đục thân'],
            tips: [{ icon:'💧', text:'Tưới đều, tránh ngập úng dài ngày' }, { icon:'🌿', text:'Bón phân cân đối N-P-K' }, { icon:'🔍', text:'Kiểm tra định kỳ mỗi 7 ngày' }],
            status: 'healthy', statusText: 'Không phát hiện bệnh nghiêm trọng', diseaseLabel: 'Đạo ôn / Bạc lá',
        },
        corn: {
            viName: 'Ngô / Bắp',
            tableRows: [
                { label: 'Màu lá',      ok: '🟢 Xanh sáng',    bad: '🟤 Vàng / xỉn' },
                { label: 'Đốm / vết',   ok: '✅ Không',         bad: '❌ Đốm gỉ sắt' },
                { label: 'Thân',        ok: '💪 Cứng chắc',    bad: '🥀 Thối, mềm' },
                { label: 'Bắp',         ok: '🌽 Đầy hạt',      bad: '🍂 Hạt lép/nấm' },
                { label: 'Rễ',         ok: '🌱 Trắng, mập',   bad: '🟫 Thối nâu' },
            ],
            checks: ['✅ Lá xanh, thân thẳng → Khỏe', '⚠️ Đốm gỉ màu cam → Gỉ sắt ngô', '⚠️ Lá vàng từ dưới lên → Thiếu đạm', '🚨 Thân xốp, bẻ dễ → Thối thân'],
            tips: [{ icon:'☀️', text:'Cần 6-8 giờ nắng mỗi ngày' }, { icon:'💧', text:'Tưới đều, không đọng nước gốc' }, { icon:'🧪', text:'Phun thuốc phòng gỉ sắt khi thời tiết ẩm' }],
            status: 'healthy', statusText: 'Cây phát triển bình thường', diseaseLabel: 'Gỉ sắt / Thối thân',
        },
        wheat: {
            viName: 'Lúa mì',
            tableRows: [
                { label: 'Màu lá',      ok: '🟢 Xanh xám',     bad: '🟡 Vàng sọc' },
                { label: 'Sọc / vệt',   ok: '✅ Không có',      bad: '❌ Sọc vàng/cam' },
                { label: 'Hạt',         ok: '🌾 Chắc mẩy',     bad: '🍂 Teo, đen' },
                { label: 'Thân',        ok: '💚 Xanh cứng',    bad: '🟤 Gỉ sắt nâu' },
                { label: 'Rễ',          ok: '🌱 Phát triển',    bad: '🟫 Yếu, ít' },
            ],
            checks: ['✅ Lá xanh đều → Khỏe', '⚠️ Sọc vàng dọc lá → Gỉ vàng', '⚠️ Đốm cam trên thân → Gỉ nâu', '🚨 Bông đen, hạt rỗng → Bệnh than'],
            tips: [{ icon:'🌡️', text:'Trồng khi nhiệt độ 15-20°C' }, { icon:'💊', text:'Phun thuốc gỉ sắt phòng ngừa' }, { icon:'🌾', text:'Thu hoạch đúng độ chín' }],
            status: 'healthy', statusText: 'Cây lúa mì khỏe mạnh', diseaseLabel: 'Gỉ vàng / Gỉ nâu',
        },
        soybean: {
            viName: 'Đậu nành',
            tableRows: [
                { label: 'Màu lá',      ok: '🟢 Xanh đậm',     bad: '🟡 Vàng rụng' },
                { label: 'Đốm',         ok: '✅ Sạch',          bad: '❌ Đốm nâu/đỏ' },
                { label: 'Vỏ đậu',      ok: '💚 Xanh chắc',    bad: '🟫 Nâu, móp' },
                { label: 'Thân',        ok: '📏 Thẳng đứng',   bad: '🥀 Héo rũ' },
                { label: 'Hạt',         ok: '⭕ Tròn mẩy',     bad: '🔺 Nhăn nheo' },
            ],
            checks: ['✅ Lá xanh mướt → Khỏe', '⚠️ Đốm gỉ màu nâu đỏ → Gỉ đậu nành', '⚠️ Lá vàng chữ V → Thiếu kali', '🚨 Thân đen thối → Thối thân Phytophthora'],
            tips: [{ icon:'🌱', text:'Luân canh với lúa để phá vòng bệnh' }, { icon:'💊', text:'Xử lý hạt giống trước khi gieo' }, { icon:'☔', text:'Tránh để ruộng quá ẩm' }],
            status: 'healthy', statusText: 'Đậu nành phát triển tốt', diseaseLabel: 'Gỉ sắt / Thối thân',
        },
        sugarcane: {
            viName: 'Mía',
            tableRows: [
                { label: 'Lá',          ok: '🟢 Xanh bóng',    bad: '🟡 Vàng sọc' },
                { label: 'Thân',        ok: '🟤 Nâu đều đẹp',  bad: '🔴 Đốm đỏ/thối' },
                { label: 'Đốt mía',     ok: '📏 Dài đều',      bad: '📉 Ngắn, méo' },
                { label: 'Mắt mía',     ok: '✅ Chắc khỏe',    bad: '❌ Mốc, lõm' },
                { label: 'Ngọn',        ok: '🌿 Xanh vươn',   bad: '🥀 Xoắn héo' },
            ],
            checks: ['✅ Thân cứng, lá xanh đều → Khỏe', '⚠️ Sọc vàng dọc lá → Bệnh sọc vàng', '⚠️ Thân đỏ bên trong → Thối đỏ', '🚨 Ngọn xoắn, lá trắng → Bệnh trắng lá'],
            tips: [{ icon:'💧', text:'Tưới đầy đủ mùa khô' }, { icon:'🔪', text:'Vệ sinh dao khi chặt hom' }, { icon:'🌱', text:'Dùng hom giống sạch bệnh' }],
            status: 'healthy', statusText: 'Mía phát triển bình thường', diseaseLabel: 'Thối đỏ / Trắng lá',
        },
        cassava: {
            viName: 'Sắn / Khoai mì',
            tableRows: [
                { label: 'Lá',          ok: '🟢 Xanh sáng',    bad: '🟡 Vàng loang' },
                { label: 'Gân lá',      ok: '✅ Xanh bình thường', bad: '❌ Vàng / nâu' },
                { label: 'Thân',        ok: '🌿 Cứng thẳng',   bad: '🥀 Teo khô' },
                { label: 'Củ',          ok: '⬜ Trắng ngà',    bad: '🟤 Thâm nâu' },
                { label: 'Rễ',          ok: '🌱 Nhiều, mập',   bad: '🟫 Thối, ít' },
            ],
            checks: ['✅ Lá xanh bóng, không đốm → Khỏe', '⚠️ Đốm nâu trên lá → Brown streak', '⚠️ Lá vàng, gân nâu → Mosaic virus', '🚨 Thân teo, ít lá → Bệnh chổi rồng'],
            tips: [{ icon:'🌱', text:'Dùng hom từ cây mẹ khỏe mạnh' }, { icon:'🐛', text:'Kiểm soát rệp sáp định kỳ' }, { icon:'🔄', text:'Luân canh 2-3 năm/lần' }],
            status: 'healthy', statusText: 'Sắn phát triển bình thường', diseaseLabel: 'Mosaic / Brown streak',
        },
        potato: {
            viName: 'Khoai tây',
            tableRows: [
                { label: 'Lá',          ok: '🟢 Xanh tươi',    bad: '🟤 Nâu thối' },
                { label: 'Viền lá',     ok: '✅ Đều, nguyên',   bad: '❌ Cháy, cuộn' },
                { label: 'Thân',        ok: '💚 Xanh cứng',    bad: '🥀 Đen thối gốc' },
                { label: 'Củ',          ok: '🟡 Vàng sáng',    bad: '🟫 Đốm đen thối' },
                { label: 'Mùi',         ok: '✅ Không mùi',     bad: '❌ Mùi thối' },
            ],
            checks: ['✅ Lá xanh đều, không đốm → Khỏe', '⚠️ Đốm nâu viền vàng → Mọc sương (Late blight)', '⚠️ Lá cuộn, vàng → Virus Y', '🚨 Thân đen thối từ gốc → Héo vàng'],
            tips: [{ icon:'❄️', text:'Trồng ở nhiệt độ mát 15-20°C' }, { icon:'💊', text:'Phun thuốc phòng nấm khi mưa nhiều' }, { icon:'🌾', text:'Thu hoạch trước khi lá khô hoàn toàn' }],
            status: 'healthy', statusText: 'Khoai tây phát triển tốt', diseaseLabel: 'Late blight / Virus Y',
        },
        sweet_potato: {
            viName: 'Khoai lang',
            tableRows: [
                { label: 'Dây lá',      ok: '🟢 Xanh mướt',    bad: '🟡 Vàng úa' },
                { label: 'Đốm lá',      ok: '✅ Không',         bad: '❌ Đốm vòng' },
                { label: 'Thân dây',    ok: '🌿 Dẻo, xanh',   bad: '🥀 Khô, giòn' },
                { label: 'Củ',          ok: '🟠 Cam/tím đẹp', bad: '🟫 Thâm, nứt' },
                { label: 'Rễ phụ',      ok: '🌱 Trắng nhiều', bad: '🟫 Nâu, ít' },
            ],
            checks: ['✅ Dây xanh tốt, nhiều lá → Khỏe', '⚠️ Đốm vòng đồng tâm → Bệnh đốm vòng', '⚠️ Lá vàng từ già → Thiếu dinh dưỡng', '🚨 Củ thối đen → Weevil/Thối củ'],
            tips: [{ icon:'☀️', text:'Cần ánh sáng đầy đủ 8h/ngày' }, { icon:'🌱', text:'Đất tơi xốp, thoát nước tốt' }, { icon:'🐛', text:'Kiểm soát sùng đục củ' }],
            status: 'healthy', statusText: 'Khoai lang phát triển tốt', diseaseLabel: 'Đốm vòng / Thối củ',
        },
    };

    let key = pred;
    if (pred.startsWith('sweet_potato')) key = 'sweet_potato';
    else key = pred.split('_')[0];

    return base[key] || base['rice'];
}

function renderCompareModal(result) {
    try {
        if (!result) { console.warn('renderCompareModal: no result'); return; }

        const pred    = result.prediction || result.class || '';
        const prob    = parseFloat(result.probability || result.confidence || 0);
        const details = result.details || {};

        const data    = getCompareData(pred);
        const viName  = details.vi || data.viName || pred.replace(/_/g,' ').toUpperCase() || 'Cây trồng';

        const el = (id) => document.getElementById(id);

        // ── 1. Header ──
        const titleEl = el('cmp-title');
        if (titleEl) titleEl.textContent = 'So Sánh: ' + viName.toUpperCase();

        const subEl = el('cmp-subtitle');
        if (subEl) subEl.textContent = (details.ten_khoa_hoc ? details.ten_khoa_hoc + ' — ' : '') + 'Độ tin cậy: ' + (prob * 100).toFixed(1) + '%';

        // ── 2. Images ──
        const scanEl = el('compare-scan-img');
        if (scanEl) {
            // Thử lấy ảnh từ nhiều nguồn
            const previewEl = document.getElementById('preview-img');
            const src = (previewEl && previewEl.src && !previewEl.src.endsWith('/') ? previewEl.src : '')
                     || result.image_url || result.image || '';
            if (src) {
                scanEl.src = src;
                scanEl.style.display = 'block';
            } else {
                scanEl.parentElement.innerHTML = '<div class="cmp-img-no-img">📸<span>Chưa có ảnh</span></div>';
            }
        }

        const healthEl = el('compare-healthy-img');
        if (healthEl) { healthEl.src = getHealthyImg(pred); healthEl.style.display = 'block'; }

        const diseaseEl = el('compare-disease-img');
        if (diseaseEl) { diseaseEl.src = getDiseaseImg(pred); diseaseEl.style.display = 'block'; }

        const yourLbl = el('cmp-your-label');
        if (yourLbl) yourLbl.textContent = viName;

        const disLbl = el('cmp-disease-label');
        if (disLbl) disLbl.textContent = data.diseaseLabel || 'Dạng bệnh điển hình';

        // ── 3. Status banner ──
        const banner    = el('cmp-status-banner');
        const sIcon     = el('cmp-status-icon');
        const sTitle    = el('cmp-status-title');
        const sDesc     = el('cmp-status-desc');
        const sProb     = el('cmp-status-prob');

        if (sProb) sProb.textContent = (prob * 100).toFixed(1) + '%';
        if (banner) {
            banner.className = 'cmp-status-banner';
            if (prob >= 0.75) {
                banner.classList.add('status-healthy');
                if (sIcon)  sIcon.textContent  = '✅';
                if (sTitle) sTitle.textContent = 'Cây Khỏe Mạnh';
                if (sDesc)  sDesc.textContent  = 'AI nhận diện rõ ràng. Không có dấu hiệu bệnh nghiêm trọng.';
            } else if (prob >= 0.45) {
                banner.classList.add('status-warning');
                if (sIcon)  sIcon.textContent  = '⚠️';
                if (sTitle) sTitle.textContent = 'Cần Theo Dõi';
                if (sDesc)  sDesc.textContent  = 'Độ tin cậy trung bình. Hãy so sánh kỹ với mẫu bệnh.';
            } else {
                banner.classList.add('status-danger');
                if (sIcon)  sIcon.textContent  = '🚨';
                if (sTitle) sTitle.textContent = 'Nguy Cơ Cao';
                if (sDesc)  sDesc.textContent  = 'Cần kiểm tra kỹ hoặc tham vấn chuyên gia.';
            }
        }

        // ── 4. Comparison table ──
        const tbody = el('cmp-table-body');
        if (tbody && data.tableRows && data.tableRows.length) {
            tbody.innerHTML = data.tableRows.map(r =>
                `<div class="cmp-table-row">
                    <div class="cmp-label">${r.label}</div>
                    <div class="cmp-ok">${r.ok}</div>
                    <div class="cmp-bad">${r.bad}</div>
                </div>`
            ).join('');
        }

        // ── 5. Checklist ──
        const chk = el('cmp-checklist');
        if (chk && data.checks && data.checks.length) {
            chk.innerHTML = data.checks.map(c => {
                const icon = c.startsWith('✅') ? '✅' : c.startsWith('⚠️') ? '⚠️' : '🚨';
                const text = c.replace(/^[✅⚠️🚨]\s*/, '');
                return `<div class="cmp-check-item"><span class="cmp-check-icon">${icon}</span><span>${text}</span></div>`;
            }).join('');
        }

        // ── 6. Tips ──
        const tips = el('cmp-tips-body');
        if (tips && data.tips && data.tips.length) {
            tips.innerHTML = data.tips.map(t =>
                `<div class="cmp-tip-item"><span>${t.icon}</span><span>${t.text}</span></div>`
            ).join('');
        }

    } catch(err) {
        console.error('renderCompareModal error:', err);
    }
}

// ═══════════════════════════════════════════════════════════
// UC-F04: TREATMENT — Load phác đồ điều trị chi tiết
// ═══════════════════════════════════════════════════════════
async function loadTreatments(cropKey) {
    const section = document.getElementById('treatment-section');
    if (!section) return;
    try {
        const res = await fetch(`/api/treatments/${cropKey}`);
        const data = await res.json();
        if (!data.success || !data.diseases || data.diseases.length === 0) {
            section.innerHTML = '<p style="color:#94a3b8;font-size:13px;">Chưa có dữ liệu điều trị cho loại cây này.</p>';
            return;
        }
        section.innerHTML = data.diseases.map(d => {
            const sevColor = d.severity === 'critical' ? '#dc2626' : d.severity === 'high' ? '#f59e0b' : '#16a34a';
            const sevLabel = d.severity === 'critical' ? '🔴 Nghiêm trọng' : d.severity === 'high' ? '🟡 Cao' : '🟢 Trung bình';
            return `
            <details style="border:1px solid #e2e8f0;border-radius:12px;margin-bottom:10px;overflow:hidden;">
                <summary style="padding:12px 16px;cursor:pointer;font-weight:700;font-size:14px;background:#f8fafc;display:flex;align-items:center;gap:8px;">
                    <span>🦠 ${d.disease_vi}</span>
                    <span style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:20px;background:${sevColor}15;color:${sevColor};font-weight:700;">${sevLabel}</span>
                </summary>
                <div style="padding:14px 16px;">
                    <div style="margin-bottom:10px;">
                        <div style="font-weight:700;color:#dc2626;font-size:13px;margin-bottom:6px;">🚨 Xử lý Khẩn cấp</div>
                        ${d.emergency.map(e => `<div style="font-size:13px;color:#334155;margin-bottom:3px;padding-left:16px;">• ${e}</div>`).join('')}
                    </div>
                    <div style="margin-bottom:10px;">
                        <div style="font-weight:700;color:#2563eb;font-size:13px;margin-bottom:6px;">💊 Hóa học</div>
                        ${d.chemical.map(c => `<div style="font-size:13px;color:#334155;margin-bottom:4px;padding-left:16px;border-left:2px solid #3b82f6;padding:4px 0 4px 12px;">
                            <strong>${c.name}</strong> — ${c.dosage}<br><span style="color:#64748b;font-size:12px;">${c.note}</span>
                        </div>`).join('')}
                    </div>
                    <div style="margin-bottom:10px;">
                        <div style="font-weight:700;color:#16a34a;font-size:13px;margin-bottom:6px;">🌿 Sinh học</div>
                        ${d.biological.map(b => `<div style="font-size:13px;color:#334155;margin-bottom:3px;padding-left:16px;">• ${b}</div>`).join('')}
                    </div>
                    <div>
                        <div style="font-weight:700;color:#7c3aed;font-size:13px;margin-bottom:6px;">🛡️ Phòng ngừa</div>
                        ${d.prevention.map(p => `<div style="font-size:13px;color:#334155;margin-bottom:3px;padding-left:16px;">• ${p}</div>`).join('')}
                    </div>
                </div>
            </details>`;
        }).join('');
    } catch(e) {
        console.error('loadTreatments error:', e);
        section.innerHTML = '<p style="color:#94a3b8;font-size:13px;">Không tải được dữ liệu điều trị.</p>';
    }
}

// ═══════════════════════════════════════════════════════════
// UC-F08: EXPERT REQUEST — Gửi yêu cầu Chuyên gia
// ═══════════════════════════════════════════════════════════
function openExpertModal() {
    if (!currentResult) { alert('Hãy quét ảnh cây trước!'); return; }
    if (!currentUser) { alert('Hãy đăng nhập trước!'); return; }
    const modal = document.getElementById('expert-request-modal');
    const infoEl = document.getElementById('expert-ai-info');
    if (infoEl) {
        const prob = ((currentResult.probability || 0) * 100).toFixed(1);
        infoEl.innerHTML = `⚠️ AI nhận diện: <strong>${currentResult.prediction || 'N/A'}</strong> (${prob}% tin cậy).<br>Độ tin cậy ${prob < 50 ? '<span style="color:#dc2626;font-weight:700;">THẤP</span> — Khuyến khích hỏi chuyên gia' : 'trung bình'}.`;
    }
    modal.style.display = 'flex';
}

async function submitExpertRequest() {
    if (!currentUser) { alert('Đăng nhập trước!'); return; }
    const note = document.getElementById('expert-note').value;
    const location = document.getElementById('expert-location').value;
    const urgency = document.getElementById('expert-urgency').value;
    if (!note.trim()) { alert('Vui lòng mô tả triệu chứng!'); return; }
    try {
        const res = await fetch('/api/expert-request', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: currentUser.id,
                image_url: currentResult ? currentResult.image_url : '',
                ai_prediction: currentResult ? currentResult.prediction : '',
                ai_confidence: currentResult ? currentResult.probability : 0,
                user_note: note,
                location: location,
                urgency: urgency
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast('✅ Đã gửi yêu cầu tư vấn! Chuyên gia sẽ trả lời sớm.', 'success');
            document.getElementById('expert-request-modal').style.display = 'none';
            document.getElementById('expert-note').value = '';
        } else {
            showToast('❌ Lỗi: ' + (data.error || 'Không gửi được'), 'error');
        }
    } catch(e) {
        showToast('❌ Lỗi kết nối: ' + e.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════
// UC-F07: WEATHER ALERTS — Cảnh báo thời tiết nông nghiệp
// ═══════════════════════════════════════════════════════════
async function loadWeatherAlerts() {
    try {
        const res = await fetch('/api/weather?lat=10.0&lon=106.0');
        const data = await res.json();
        if (!data.success || !data.alerts) return;

        const riskBox = document.getElementById('risk-alert-box');
        if (riskBox && data.alerts.length > 0) {
            const levelColors = { safe: '#16a34a', warning: '#f59e0b', danger: '#dc2626' };
            riskBox.style.display = 'block';
            riskBox.innerHTML = `<h4 style="margin-bottom:10px;">🌦 Cảnh Báo Thời Tiết</h4>` +
                data.alerts.map(a => `
                    <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                        <span style="font-size:24px;">${a.icon}</span>
                        <div>
                            <div style="font-weight:700;font-size:13px;color:${levelColors[a.level] || '#475569'}">${a.title}</div>
                            <div style="font-size:12px;color:#64748b;">${a.desc}</div>
                        </div>
                    </div>
                `).join('');
        }
    } catch(e) {
        console.error('Weather error:', e);
    }
}

// ═══════════════════════════════════════════════════════════
// UC-A02: SYSTEM BROADCAST — Nhận thông báo khẩn từ Admin
// ═══════════════════════════════════════════════════════════
async function loadBroadcast() {
    try {
        const res = await fetch('/api/broadcast');
        const data = await res.json();
        if (data.success && data.broadcast) {
            const bc = data.broadcast;
            const container = document.getElementById('notification-container');
            if (!container) return;
            
            // Check if we already showed it (using localStorage to avoid spamming every refresh)
            const lastShown = localStorage.getItem('last_broadcast_time');
            if (lastShown === bc.time) return;
            
            const levelColors = {
                'info': { bg: '#eff6ff', border: '#bfdbfe', icon: 'ℹ️' },
                'warning': { bg: '#fef3c7', border: '#fde68a', icon: '⚠️' },
                'danger': { bg: '#fef2f2', border: '#fecaca', icon: '🚨' }
            };
            const theme = levelColors[bc.level] || levelColors['info'];
            
            const alertBox = document.createElement('div');
            alertBox.style.cssText = `background:${theme.bg};border:1px solid ${theme.border};padding:16px;border-radius:12px;margin-bottom:10px;box-shadow:0 4px 12px rgba(0,0,0,0.1);display:flex;gap:12px;align-items:flex-start;animation: slideIn 0.3s ease-out;position:relative;`;
            alertBox.innerHTML = `
                <div style="font-size:24px;">${theme.icon}</div>
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">${bc.title}</div>
                    <div style="font-size:13px;color:#475569;">${bc.message}</div>
                </div>
                <button onclick="this.parentElement.remove(); localStorage.setItem('last_broadcast_time', '${bc.time}')" style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:14px;cursor:pointer;color:#94a3b8;">✖</button>
            `;
            container.appendChild(alertBox);
        }
    } catch(e) { console.error("Lỗi tải broadcast:", e); }
}

// ── GỌI API & GRAD-CAM ──
async function analyzeImage(blob, imgUrl) {
    if (!currentUser) {
        showToast("Vui lòng đăng nhập để hệ thống AI phân tích cây cho bạn!", "info");
        document.getElementById('auth-modal').style.display = 'flex';
        return;
    }
    if (overlay) overlay.style.display = 'flex';
    if (scannerBox) scannerBox.classList.add('active');

    const formData = new FormData();
    formData.append('file', blob, 'capture.jpg');
    if (currentUser) formData.append('user_id', currentUser.id);

    try {
        const response = await fetch('/predict', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
            // Lưu heatmap nhưng không hiển thị đè lên ảnh gốc
            if (data.details && data.details.heatmap && heatmapImg) {
                heatmapImg.src = data.details.heatmap;
                // heatmapImg.style.display = 'block'; // Tắt để giữ ảnh gốc
            }
            updateEncyclopedia(data);
            fetchHistory();
        } else { alert("Lỗi AI: " + data.error); }
    } catch (err) { alert("Lỗi kết nối Máy chủ AI."); }
    finally {
        if (overlay) overlay.style.display = 'none';
        setTimeout(() => { if (scannerBox) scannerBox.classList.remove('active') }, 1000);
    }
}

function updateEncyclopedia(data) {
    currentResult = data;
    const placeholderCard = document.getElementById('crop-card');
    if (placeholderCard) placeholderCard.style.display = 'none';
    if (dynEncyc) dynEncyc.style.display = 'block';

    const details = data.details || {};
    const safeSet = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };

    safeSet('c-name', (details.vi || data.prediction).toUpperCase());
    safeSet('c-sci', details.ten_khoa_hoc || "Unknown");

    const probPct = (data.probability * 100).toFixed(2);
    safeSet('c-prob', probPct + "%");
    const bar = document.getElementById('c-bar');
    if (bar) bar.style.width = probPct + "%";

    // Tổng quan
    safeSet('c-desc', details.mo_ta || "Chưa có mô tả.");
    safeSet('c-temp', details.nhiet_do || "N/A");
    safeSet('c-rain', details.luong_mua || "N/A");
    safeSet('c-time', details.thoi_gian_sinh_truong || "N/A");

    // Phân loại khoa học
    safeSet('c-sci2', details.ten_khoa_hoc || "-");
    safeSet('c-family', details.ho || "-");
    safeSet('c-season', details.mua_vu || "-");
    safeSet('c-soil', details.dat || "-");
    safeSet('c-region', details.vung_trong || "-");
    safeSet('c-yield', details.san_luong_vn || "-");

    // Giai thoại
    safeSet('c-story', details.cau_chuyen || "Đang thu thập dữ liệu.");
    safeSet('c-fact', details.su_that || "Đang thu thập dữ liệu.");
    safeSet('c-symbol', details.bieu_tuong || "Đang thu thập dữ liệu.");

    // Chăm sóc
    safeSet('c-tips', details.meo_trong_cay || "Đang thu thập dữ liệu.");
    safeSet('c-cond', details.dieu_kien_van_hoa || "Đang thu thập dữ liệu.");
    safeSet('c-nutrition', details.dinh_duong || "-");
    safeSet('c-products', details.san_pham || "-");

    // Ứng dụng
    safeSet('c-use', details.ung_dung || "Đang thu thập dữ liệu.");

    // Bệnh hại
    const wList = document.getElementById('c-warnings');
    if (wList) {
        if (details.warnings) {
            wList.innerHTML = details.warnings.map(w => `<li onclick="showTreatmentModal('${w}')">${w}</li>`).join('');
        } else wList.innerHTML = '<li>Đang tính toán rủi ro...</li>';
    }

    // Thư viện ảnh
    const galleryHealthy = document.getElementById('c-gallery-healthy');
    const galleryHeatmap = document.getElementById('c-gallery-heatmap');
    if (galleryHealthy) {
        galleryHealthy.src = details.healthy_img || "";
        galleryHealthy.style.display = details.healthy_img ? 'block' : 'none';
    }
    if (galleryHeatmap && details.heatmap) {
        galleryHeatmap.src = details.heatmap;
        galleryHeatmap.style.display = 'block';
    }

    // Reset tab về Tổng quan
    document.querySelectorAll('.encyc-pane').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
    const overviewPane = document.getElementById('tab-overview');
    if (overviewPane) { overviewPane.style.display = 'block'; overviewPane.classList.add('active'); }
    document.querySelectorAll('.encyc-tab').forEach(t => t.classList.remove('active'));
    const firstTab = document.querySelector('.encyc-tab[data-tab="tab-overview"]');
    if (firstTab) firstTab.classList.add('active');

    // Show dynamic encyc card
    const cropCard = document.getElementById('crop-card');
    if (cropCard) cropCard.style.display = 'none';

    triggerRiskAlert(data.prediction);

    // UC-F04: Auto-load phác đồ điều trị chi tiết
    const cropKey = data.prediction.startsWith('sweet_potato') ? 'sweet_potato' : data.prediction.split('_')[0];
    loadTreatments(cropKey);

    // UC-F07: Load cảnh báo thời tiết
    loadWeatherAlerts();

    // UC-F08: Kết nối nút Hỏi Chuyên gia
    const btnExpert = document.getElementById('btn-ask-expert');
    if (btnExpert) btnExpert.onclick = openExpertModal;

    // Auto-suggest expert if confidence is low (< 50%)
    if (data.probability < 0.50) {
        setTimeout(() => {
            const wantExpert = confirm("AI nhận diện với độ tin cậy thấp. Bạn có muốn gửi ảnh này cho Chuyên gia tư vấn không?");
            if (wantExpert) openExpertModal();
        }, 1500);
    }
}

function showTreatmentModal(name) {
    const tm = document.getElementById('treat-modal');
    document.getElementById('treat-title').innerText = `Hướng dẫn: ${name}`;
    document.getElementById('treat-emergency').innerText = "Cách ly cây bệnh ngay tại vùng phát hiện.";
    document.getElementById('treat-chemical').innerText = "Sử dụng chế phẩm đặc trị theo khuyến cáo BVTV.";
    document.getElementById('treat-biological').innerText = "Bón vôi và phân hữu cơ để cải tạo đất.";
    if (tm) tm.style.display = 'flex';
}

async function fetchHistory() {
    try {
        let url = '/api/history';
        if (currentUser) url += `?user_id=${currentUser.id}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.length === 0 && !currentUser) {
            scanHistory = [
                { id: "demo-rice", prediction: "rice_stalk", probability: 0.9245, time: "23:55:12", image: "https://kbdbvakemunkuprohucw.supabase.co/storage/v1/object/public/scans/demo_rice.jpg" },
                { id: "demo-sugarcane", prediction: "sugarcane_leaf", probability: 0.1627, time: "23:50:05", image: "https://kbdbvakemunkuprohucw.supabase.co/storage/v1/object/public/scans/demo_sugarcane.jpg" },
                { id: "demo-corn", prediction: "corn_stalk", probability: 0.6852, time: "23:40:32", image: "https://kbdbvakemunkuprohucw.supabase.co/storage/v1/object/public/scans/demo_corn.jpg" }
            ];
        } else {
            scanHistory = data;
        }
        renderHistory();
        renderFullHistory();
        updateProfileStats();
        if (currentUser) loadExpertInbox();
    } catch (err) { console.error(err); }
}

async function loadExpertInbox() {
    const inbox = document.getElementById('expert-inbox-list');
    if (!currentUser) {
        if (inbox) inbox.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;background:#f8fafc;border-radius:12px;">Vui lòng đăng nhập để xem phản hồi từ chuyên gia</div>';
        return;
    }
    try {
        const res = await fetch(`/api/my-expert-responses?user_id=${currentUser.id}`);
        const data = await res.json();
        const inbox = document.getElementById('expert-inbox-list');
        if (!inbox) return;
        
        if (data.length === 0) {
            inbox.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;background:#f8fafc;border-radius:12px;">Chưa có phản hồi nào từ chuyên gia</div>';
            return;
        }
        
        inbox.innerHTML = data.map(r => `
            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:white;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-weight:700;color:#16a34a;">👨‍🔬 Phản hồi từ chuyên gia</span>
                    <span style="font-size:12px;color:#94a3b8;">${r.response_time ? r.response_time.split('T')[0] : ''}</span>
                </div>
                <div style="display:flex;gap:12px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;">
                    <img src="${r.image_url}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'">
                    <div>
                        <div style="font-size:13px;font-weight:600;">Bạn đã hỏi về: ${r.prediction}</div>
                        <div style="font-size:12px;color:#64748b;">${r.request_time ? r.request_time.split('T')[0] : ''}</div>
                    </div>
                </div>
                <div style="font-size:14px;color:#334155;margin-bottom:8px;"><strong>Chẩn đoán:</strong> ${r.diagnosis || 'Không có chẩn đoán'}</div>
                <div style="font-size:14px;color:#b45309;background:#fef3c7;padding:8px;border-radius:8px;margin-bottom:8px;"><strong>Điều trị:</strong> ${r.treatment || 'Không có hướng dẫn'}</div>
                ${r.notes ? `<div style="font-size:13px;color:#64748b;"><em>Ghi chú: ${r.notes}</em></div>` : ''}
            </div>
        `).join('');
    } catch(e) { 
        console.error('Lỗi tải hộp thư:', e); 
        const inbox = document.getElementById('expert-inbox-list');
        if (inbox) inbox.innerHTML = '<div style="text-align:center;padding:20px;color:#dc2626;background:#fef2f2;border-radius:12px;">Lỗi kết nối máy chủ! Hãy chắc chắn bạn đã chạy lại start_project.bat</div>';
    }
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = scanHistory.map(item => `
        <div class="history-item" data-id="${item.id}" onclick="loadHistoryItem('${item.id}')">
            <img src="${item.image}" class="history-img" onerror="this.src='https://via.placeholder.com/50'"/>
            <div class="history-info">
                <strong>${item.prediction.toUpperCase().replace('_', ' ')}</strong>
                <small>${(item.probability * 100).toFixed(1)}% • ${item.time}</small>
            </div>
        </div>
    `).join('');
}

// UC-F05: Full history with filters in Garden tab
function renderFullHistory() {
    const list = document.getElementById('history-full-list');
    const countEl = document.getElementById('history-count');
    if (!list) return;
    const items = getFilteredHistory();
    if (countEl) countEl.textContent = `Hiển thị ${items.length} / ${scanHistory.length} kết quả`;
    if (items.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;"><div style="font-size:40px;margin-bottom:8px;">📭</div><p>Chưa có lịch sử quét nào</p></div>';
        return;
    }
    list.innerHTML = items.map(item => {
        const prob = (item.probability * 100).toFixed(1);
        const probColor = prob >= 70 ? '#16a34a' : prob >= 45 ? '#f59e0b' : '#ef4444';
        const probLabel = prob >= 70 ? '✅' : prob >= 45 ? '⚠️' : '🚨';
        const cropName = item.prediction ? item.prediction.replace(/_/g, ' ').toUpperCase() : 'N/A';
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;cursor:pointer;background:white;transition:0.2s;" onclick="loadHistoryItem('${item.id}')" onmouseover="this.style.borderColor='#16a34a'" onmouseout="this.style.borderColor='#e2e8f0'">
            <img src="${item.image}" style="width:56px;height:56px;border-radius:10px;object-fit:cover;" onerror="this.src='https://via.placeholder.com/56'">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cropName}</div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                    <span style="font-size:12px;color:${probColor};font-weight:700;">${probLabel} ${prob}%</span>
                    <span style="font-size:11px;color:#94a3b8;">• ${item.time || ''} ${item.date || ''}</span>
                </div>
            </div>
            <button onclick="event.stopPropagation();deleteHistoryItem('${item.id}')" style="background:none;border:none;font-size:16px;cursor:pointer;color:#94a3b8;padding:4px;" title="Xóa">🗑️</button>
        </div>`;
    }).join('');
}

function getFilteredHistory() {
    let items = [...scanHistory];
    const cropFilter = document.getElementById('history-filter-crop');
    const statusFilter = document.getElementById('history-filter-status');
    if (cropFilter && cropFilter.value) {
        items = items.filter(h => h.prediction && h.prediction.startsWith(cropFilter.value));
    }
    if (statusFilter && statusFilter.value) {
        if (statusFilter.value === 'healthy') items = items.filter(h => h.probability >= 0.70);
        else if (statusFilter.value === 'warning') items = items.filter(h => h.probability >= 0.45 && h.probability < 0.70);
        else if (statusFilter.value === 'danger') items = items.filter(h => h.probability < 0.45);
    }
    return items;
}

function filterHistory() { renderFullHistory(); }

async function deleteHistoryItem(id) {
    if (!confirm('Xóa bản ghi này?')) return;
    try {
        await fetch(`/api/history/${id}`, { method: 'DELETE' });
        scanHistory = scanHistory.filter(h => h.id !== id);
        renderHistory();
        renderFullHistory();
        showToast('Đã xóa bản ghi', 'success');
    } catch(e) { showToast('Lỗi khi xóa', 'error'); }
}


async function loadHistoryItem(id) {
    try {
        let data;
        if (id.startsWith('demo-')) {
            if (id === 'demo-rice') {
                data = {
                    id: id, prediction: 'rice_stalk', probability: 0.9245,
                    image_url: "https://kbdbvakemunkuprohucw.supabase.co/storage/v1/object/public/scans/demo_rice.jpg",
                    details: { vi: "Thân Lúa/Rơm", ten_khoa_hoc: "Oryza sativa", nhiet_do: "20 - 35°C", luong_mua: "1.200 - 3.000 mm/năm", thoi_gian_sinh_truong: "3.5 - 5 tháng", mo_ta: "Cây lúa phát triển ổn định.", warnings: ["Sâu đục thân", "Đạo ôn"] }
                };
            } else if (id === 'demo-sugarcane') {
                data = {
                    id: id, prediction: 'sugarcane_leaf', probability: 0.1627,
                    image_url: "https://kbdbvakemunkuprohucw.supabase.co/storage/v1/object/public/scans/demo_sugarcane.jpg",
                    details: { vi: "Lá Mía", ten_khoa_hoc: "Saccharum officinarum", nhiet_do: "25 - 35°C", mo_ta: "Cây mía đang phát triển.", warnings: ["Rì sắt", "Sâu đục thân"] }
                };
            } else {
                data = {
                    id: id, prediction: 'corn_stalk', probability: 0.6852,
                    image_url: "https://kbdbvakemunkuprohucw.supabase.co/storage/v1/object/public/scans/demo_corn.jpg",
                    details: { vi: "Thân cây Ngô", ten_khoa_hoc: "Zea mays", mo_ta: "Cây ngô khỏe mạnh." }
                };
            }
        } else {
            const response = await fetch(`/api/history/${id}`);
            data = await response.json();
        }

        if (data && (data.image_url || data.image)) {
            imgPreview.src = data.image_url || data.image;
            imgPreview.style.display = 'block';
            updateEncyclopedia(data);
            placeholder.style.display = 'none';
        }
    } catch (err) { console.error(err); }
}

async function triggerRiskAlert(crop) {
    const riskBox = document.getElementById('risk-alert-box');
    if (!riskBox) return;
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=21.028&longitude=105.85&hourly=relative_humidity_2m&timezone=auto');
        const data = await res.json();
        const humid = data.hourly.relative_humidity_2m[0];
        riskBox.innerHTML = humid > 80 ? `⚠️ <strong>Rủi ro:</strong> Độ ẩm ${humid}%. Nguy cơ nấm trên ${crop}!` : `✅ <strong>An toàn:</strong> Độ ẩm ${humid}%.`;
        riskBox.style.display = 'block';
    } catch (e) { riskBox.style.display = 'none'; }
}

// ---------------------------------------------------------------- //
// ----------------- CROP SOCIAL & ENCYC TABS --------------------- //
// ---------------------------------------------------------------- //

document.addEventListener('DOMContentLoaded', () => {
    // Web Share API
    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.onclick = async () => {
            if (!currentResult) return alert("Bạn chưa quét cây nào!");
            try {
                if (navigator.share) {
                    await navigator.share({
                        title: 'AI Crop Scanner - ' + currentResult.details.vi,
                        text: 'Tớ vừa quét ra bệnh cho cây: ' + currentResult.details.vi + '. Xem chi tiết mẹo trồng và giai thoại nhé!',
                        url: window.location.href,
                    });
                } else {
                    alert('Trình duyệt của bạn không hỗ trợ tính năng Chia sẻ (Web Share API). Hãy tự copy dán gửi mọi người nhé!');
                }
            } catch (err) {
                console.log('User cancelled share', err);
            }
        };
    }

    // 4. Post to Community — open modal instead of prompt
    const btnPost = document.getElementById('btn-post-community');
    if (btnPost) {
        btnPost.onclick = () => {
            if (!currentUser) {
                showToast("Vui lòng đăng nhập để chia sẻ lên cộng đồng!", "info");
                document.getElementById('auth-modal').style.display = 'flex';
                return;
            }
            if (!currentResult) return alert("Bạn chưa quét cây nào!");
            openPostModal();
        };
    }

    // Refresh Btn
    const btnRef = document.getElementById('btn-refresh-feed');
    if (btnRef) btnRef.onclick = fetchCommunityFeed;
});

// ═══════════════════════════════════════════
// ═══ POST MODAL (Facebook Style) ══════════
// ═══════════════════════════════════════════

window.openPostModal = function() {
    const modal = document.getElementById('post-modal');
    if (!modal) return;
    
    // Set user info
    const email = currentUser ? currentUser.email : "Nhà Nông Ẩn Danh";
    const avatarEl = document.getElementById('pm-avatar-letter');
    const usernameEl = document.getElementById('pm-username');
    if (avatarEl) avatarEl.innerText = email.charAt(0).toUpperCase();
    if (usernameEl) usernameEl.innerText = email.split('@')[0];
    
    // Attach image from scan if available
    const preview = document.getElementById('pm-img-preview');
    const previewImg = document.getElementById('pm-preview-img');
    const cropTag = document.getElementById('pm-crop-tag');
    
    if (currentResult) {
        let imgSrc = currentResult.image_url || "";
        // Nếu image_url là đường dẫn tương đối, chuyển thành tuyệt đối
        if (imgSrc && !imgSrc.startsWith('http') && !imgSrc.startsWith('data:')) {
            imgSrc = window.location.origin + (imgSrc.startsWith('/') ? '' : '/') + imgSrc;
        }
        
        // Ưu tiên ảnh từ preview-img (ảnh vừa chụp)
        const scanPreview = document.getElementById('preview-img');
        if (scanPreview && scanPreview.src && scanPreview.style.display !== 'none') {
            imgSrc = scanPreview.src;
        }
        
        previewImg.src = imgSrc;
        preview.style.display = 'block';
        if (cropTag) cropTag.innerText = "🌿 " + (currentResult.details?.vi || currentResult.prediction);
    } else {
        preview.style.display = 'none';
    }
    
    document.getElementById('post-caption-input').value = '';
    modal.style.display = 'flex';
};

window.closePostModal = function() {
    document.getElementById('post-modal').style.display = 'none';
};

window.attachScanImage = function() {
    if (!currentResult) return alert("Hãy quét 1 ảnh cây trước!");
    const preview = document.getElementById('pm-img-preview');
    const previewImg = document.getElementById('pm-preview-img');
    let imgSrc = currentResult.image_url || "/history/" + (currentResult.id || "unknown") + ".jpg";
    previewImg.src = imgSrc;
    preview.style.display = 'block';
};

window.submitPost = async function() {
    const caption = document.getElementById('post-caption-input').value.trim();
    if (!caption) return alert("Hãy viết ít nhất vài dòng nhé!");
    
    const btn = document.getElementById('btn-submit-post');
    btn.disabled = true;
    btn.innerText = "Đang đăng...";
    
    const email = currentUser ? currentUser.email : "Nhà Nông Ẩn Danh";
    let imageUrl = "";
    if (currentResult) {
        imageUrl = currentResult.image_url || "/history/" + (currentResult.id || "unknown") + ".jpg";
        if (!imageUrl || imageUrl.includes('undefined')) {
            const scanPreview = document.getElementById('preview-img');
            if (scanPreview && scanPreview.src) imageUrl = scanPreview.src;
        }
    }
    
    try {
        const formData = new FormData();
        formData.append("user_id", currentUser.id);
        formData.append("caption", caption);
        formData.append("crop_name", currentResult ? (currentResult.details?.vi || currentResult.prediction) : "Nông nghiệp");
        formData.append("image_url", imageUrl);

        const res = await fetch('/api/community/post', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            closePostModal();
            const tabComm = document.getElementById('tab-community');
            if (tabComm) tabComm.click();
            fetchCommunityFeed();
            updateProfileStats();
            showToast("Đăng bài thành công!", "success");
        }
    } catch (e) {
        alert("Lỗi đăng bài: " + e);
    } finally {
        btn.disabled = false;
        btn.innerText = "Đăng bài";
    }
};

// ═══════════════════════════════════════════
// ═══ COMMUNITY FEED (Instagram Style) ═════
// ═══════════════════════════════════════════

async function fetchCommunityFeed() {
    const feed = document.getElementById('community-feed');
    if(!feed) return;
    feed.innerHTML = '<div style="text-align:center; padding:40px 0; color:#94a3b8;"><div style="font-size:32px; margin-bottom:10px;">🔄</div>Đang tải bản tin...</div>';
    try {
        const res = await fetch('/api/community/posts');
        const posts = await res.json();
        postsCache = posts; // Cache for comment modal
        feed.innerHTML = '';
        if (posts.length === 0) {
            feed.innerHTML = '<div style="text-align:center; padding:60px 20px;"><div style="font-size:48px; margin-bottom:15px;">🌾</div><h3 style="color:#1e293b; margin-bottom:8px;">Chưa có bài viết nào</h3><p style="color:#94a3b8; font-size:14px;">Hãy là người đầu tiên chia sẻ kinh nghiệm trồng trọt!</p></div>';
            return;
        }

        posts.forEach(post => {
            const avatarUrl = post.avatar_url || "";
            const displayName = post.display_name || "Thành viên";
            const avatarL = displayName.charAt(0).toUpperCase();
            const timeAgo = post.time_str || "vừa xong";
            const cmtCount = post.comments_count || 0;
            
            const html = `
            <div class="post-card">
                <div class="post-header">
                    <div class="post-user">
                        <div class="user-avatar">
                            ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : avatarL}
                        </div>
                        <div class="post-info">
                            <h4>${displayName}</h4>
                            <small>${timeAgo} · 🌿 ${post.crop_name}</small>
                        </div>
                    </div>
                </div>
                ${post.image_url ? `<img src="${post.image_url}" class="post-img" onerror="this.style.display='none'">` : ''}
                <div class="post-caption">${post.caption}</div>
                <div class="post-reactions">
                    <div class="reaction-summary" id="rsummary-${post.id}">
                        <span class="reaction-icons-mini" id="rmini-${post.id}"></span>
                        <span class="like-count-${post.id}">${post.likes || 0}</span>
                    </div>
                    <span class="cmt-count-link" onclick="toggleComments('${post.id}')">💬 <span id="cmt-count-${post.id}">${cmtCount}</span> bình luận</span>
                </div>
                <div class="post-actions">
                    <div class="like-btn-wrapper" id="like-wrap-${post.id}">
                        <div class="reaction-picker" id="rpicker-${post.id}">
                            <button class="reaction-emoji" onclick="reactPost('${post.id}','🌱','Yêu thích',this)" title="Yêu thích">🌱</button>
                            <button class="reaction-emoji" onclick="reactPost('${post.id}','🌻','Tuyệt vời',this)" title="Tuyệt vời">🌻</button>
                            <button class="reaction-emoji" onclick="reactPost('${post.id}','🔥','Xuất sắc',this)" title="Xuất sắc">🔥</button>
                            <button class="reaction-emoji" onclick="reactPost('${post.id}','😍','Thương',this)" title="Thương">😍</button>
                            <button class="reaction-emoji" onclick="reactPost('${post.id}','😮','Ngạc nhiên',this)" title="Ngạc nhiên">😮</button>
                            <button class="reaction-emoji" onclick="reactPost('${post.id}','😢','Buồn',this)" title="Buồn">😢</button>
                        </div>
                        <button class="social-action-btn" id="like-btn-${post.id}" onclick="toggleLike('${post.id}')">
                            👍 Thích
                        </button>
                    </div>
                    <button class="social-action-btn" onclick="toggleComments('${post.id}')">
                        💬 Bình luận
                    </button>
                    <button class="social-action-btn" onclick="sharePost('${post.id}')">
                        ↗️ Chia sẻ
                    </button>
                </div>
            </div>`;
            feed.innerHTML += html;
        });

    } catch (e) {
        feed.innerHTML = '<p style="color:#ef4444; text-align:center; padding:30px;">Lỗi tải bản tin.</p>';
    }
}

// ═══ REACTION & LIKE SYSTEM ═══
let likedPosts = {}; // { postId: { emoji, label } or null }
let notifications = [];

window.toggleLike = function(postId) {
    const btn = document.getElementById('like-btn-' + postId);
    const countEl = document.querySelector(`.like-count-${postId}`);
    if (!btn) return;
    
    if (likedPosts[postId]) {
        // Unlike
        delete likedPosts[postId];
        btn.classList.remove('liked');
        btn.innerHTML = '👍 Thích';
        if (countEl) countEl.innerText = Math.max(0, parseInt(countEl.innerText) - 1);
    } else {
        // Like with default
        likedPosts[postId] = { emoji: '🌱', label: 'Yêu thích' };
        btn.classList.add('liked');
        btn.innerHTML = '🌱 Yêu thích';
        if (countEl) countEl.innerText = parseInt(countEl.innerText) + 1;
        updateReactionMini(postId, '🌱');
        addNotification(postId, 'like', '🌱 Yêu thích');
    }
    fetch(`/api/community/like/${postId}?user_id=${currentUser.id}`, { method: 'POST' }).catch(() => {});
};

window.reactPost = function(postId, emoji, label, btnEle) {
    const likeBtn = document.getElementById('like-btn-' + postId);
    const countEl = document.querySelector(`.like-count-${postId}`);
    
    if (likedPosts[postId] && likedPosts[postId].emoji === emoji) {
        // Same reaction = unlike
        delete likedPosts[postId];
        likeBtn.classList.remove('liked');
        likeBtn.innerHTML = '👍 Thích';
        likeBtn.style.color = '';
        if (countEl) countEl.innerText = Math.max(0, parseInt(countEl.innerText) - 1);
    } else {
        // New reaction
        const wasLiked = !!likedPosts[postId];
        likedPosts[postId] = { emoji, label };
        likeBtn.classList.add('liked');
        likeBtn.innerHTML = `${emoji} ${label}`;
        if (!wasLiked && countEl) countEl.innerText = parseInt(countEl.innerText) + 1;
        updateReactionMini(postId, emoji);
        addNotification(postId, 'react', `${emoji} ${label}`);
    }
    
    fetch(`/api/community/like/${postId}?user_id=${currentUser.id}`, { method: 'POST' }).catch(() => {});
};

function updateReactionMini(postId, emoji) {
    const mini = document.getElementById('rmini-' + postId);
    if (mini) mini.innerHTML = `<span class="rmini-icon">${emoji}</span>`;
}

// ═══ NOTIFICATION SYSTEM ═══
function addNotification(postId, type, detail) {
    const post = postsCache.find(p => p.id === postId);
    const userName = currentUser ? currentUser.email.split('@')[0] : "Ai đó";
    const postOwner = post ? (post.user_email ? post.user_email.split('@')[0] : '') : '';
    
    // Don't notify yourself
    if (userName === postOwner) return;
    
    const now = new Date();
    const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    
    let msg = '';
    if (type === 'like' || type === 'react') msg = `${userName} đã ${detail} bài viết của bạn`;
    else if (type === 'comment') msg = `${userName} đã bình luận bài viết của bạn`;
    else if (type === 'share') msg = `${userName} đã chia sẻ bài viết của bạn`;
    
    notifications.unshift({ msg, time: timeStr, postId, read: false });
    updateNotifBadge();
}

function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    const unread = notifications.filter(n => !n.read).length;
    if (badge) {
        badge.innerText = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }
}

window.toggleNotifPanel = function() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        return;
    }
    // Mark all as read
    notifications.forEach(n => n.read = true);
    updateNotifBadge();
    
    if (notifications.length === 0) {
        panel.innerHTML = '<div style="padding:30px; text-align:center; color:#94a3b8;"><div style="font-size:28px; margin-bottom:8px;">🔔</div>Chưa có thông báo</div>';
    } else {
        panel.innerHTML = '<div class="notif-header">Thông báo</div>' + notifications.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}">
                <div class="notif-text">${n.msg}</div>
                <div class="notif-time">${n.time}</div>
            </div>
        `).join('');
    }
    panel.style.display = 'block';
};

window.likePost = async function(postId, btnEle) {
    toggleLike(postId);
};

// ═══ COMMENT MODAL SYSTEM (Facebook Post Detail) ═══
let commentStore = {}; // { postId: [{name, text, time}] }
let activeCommentPostId = null;
let postsCache = []; // Lưu trữ dữ liệu posts để hiển thị trong modal

window.toggleComments = function(postId) {
    activeCommentPostId = postId;
    const modal = document.getElementById('comment-modal');
    const postSection = document.getElementById('cmt-modal-post');
    const input = document.getElementById('cmt-modal-input-field');
    const avatarEl = document.getElementById('cmt-modal-avatar');
    const titleEl = document.getElementById('cmt-modal-title');
    
    // Set user avatar
    const name = currentUser ? currentUser.email.split('@')[0] : "Bạn";
    if (avatarEl) avatarEl.innerText = name.charAt(0).toUpperCase();
    
    // Find post data
    const post = postsCache.find(p => p.id === postId);
    if (post) {
        const displayName = post.user_email ? post.user_email.split('@')[0] : "Ẩn danh";
        const avatarL = displayName.charAt(0).toUpperCase();
        const timeAgo = post.time_str || "vừa xong";
        const likes = post.likes || 0;
        const cmtCount = (commentStore[postId] || []).length;
        
        if (titleEl) titleEl.innerText = `Bài viết của ${displayName}`;
        
        postSection.innerHTML = `
            <div class="cmt-post-section">
                <div class="cmt-post-user">
                    <div class="cmt-post-avatar">${avatarL}</div>
                    <div class="cmt-post-info">
                        <h4>${displayName}</h4>
                        <small>${timeAgo} · 🌿 ${post.crop_name}</small>
                    </div>
                </div>
                ${post.image_url ? `<img src="${post.image_url}" class="cmt-post-img" onerror="this.style.display='none'">` : ''}
                <div class="cmt-post-caption">${post.caption}</div>
                <div class="cmt-post-reactions">
                    <span>❤️ ${likes} lượt thích</span>
                    <span>💬 ${cmtCount} bình luận</span>
                </div>
                <div class="cmt-post-actions">
                    <button onclick="likePost('${post.id}', this)">👍 Thích</button>
                    <button>💬 Bình luận</button>
                    <button onclick="sharePost('${post.id}')">↗️ Chia sẻ</button>
                </div>
            </div>
        `;
    }
    
    // Render comments
    renderModalComments(postId);
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => input?.focus(), 300);
};

window.closeCommentModal = function(e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById('comment-modal');
    const card = modal.querySelector('.cmt-modal-card');
    card.style.animation = 'cmtModalOut 0.2s ease forwards';
    setTimeout(() => {
        modal.style.display = 'none';
        card.style.animation = 'cmtModalIn 0.25s ease';
        document.body.style.overflow = '';
        activeCommentPostId = null;
    }, 200);
};

function renderModalComments(postId) {
    const list = document.getElementById('cmt-modal-list');
    const comments = commentStore[postId] || [];
    
    if (comments.length === 0) {
        list.innerHTML = `
            <div class="cmt-modal-empty">
                <div style="font-size:40px; margin-bottom:12px;">💬</div>
                <p style="font-size:15px; font-weight:600; color:#64748b;">Chưa có bình luận nào</p>
                <p style="font-size:13px; color:#94a3b8; margin-top:4px;">Hãy là người đầu tiên bình luận!</p>
            </div>`;
        return;
    }
    
    list.innerHTML = comments.map(c => `
        <div class="cmt-modal-item">
            <div class="cmt-modal-item-avatar">${c.name.charAt(0).toUpperCase()}</div>
            <div class="cmt-modal-item-bubble">
                <div class="cmt-modal-item-content">
                    <span class="cmt-name">${c.name}</span>
                    <span class="cmt-text">${c.text}</span>
                </div>
                <div class="cmt-modal-item-meta">
                    <span>${c.time}</span>
                    <span>Thích</span>
                    <span>Trả lời</span>
                </div>
            </div>
        </div>
    `).join('');
}

window.submitModalComment = function() {
    const input = document.getElementById('cmt-modal-input-field');
    if (!input || !input.value.trim() || !activeCommentPostId) return;
    
    const name = currentUser ? currentUser.email.split('@')[0] : "Bạn";
    const now = new Date();
    const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    
    if (!commentStore[activeCommentPostId]) commentStore[activeCommentPostId] = [];
    commentStore[activeCommentPostId].push({
        name: name,
        text: input.value.trim(),
        time: timeStr
    });
    
    input.value = '';
    renderModalComments(activeCommentPostId);
    
    // Cập nhật số bình luận trên post card + trong modal
    const cmtCount = commentStore[activeCommentPostId].length;
    const countEl = document.getElementById('cmt-count-' + activeCommentPostId);
    if (countEl) countEl.innerText = cmtCount;
    
    // Scroll body to bottom
    const body = document.getElementById('cmt-modal-body');
    if (body) body.scrollTop = body.scrollHeight;
    
    // Thông báo cho người đăng bài
    addNotification(activeCommentPostId, 'comment', '');
};

window.sharePost = function(postId) {
    if (navigator.share) {
        navigator.share({ title: 'Bài chia sẻ Nông nghiệp', text: 'Xem bài viết thú vị về nông nghiệp!', url: window.location.href });
    } else {
        navigator.clipboard.writeText(window.location.href).then(() => alert("Đã sao chép link!"));
    }
    addNotification(postId, 'share', '');
};

// ================================================================ //
// =================== KHU VƯỜN CỦA TÔI ========================== //
// ================================================================ //

function getMyGarden() {
    try { return JSON.parse(localStorage.getItem('my_garden') || '[]'); }
    catch(e) { return []; }
}

function saveMyGarden(garden) {
    localStorage.setItem('my_garden', JSON.stringify(garden));
}

function renderMyGarden() {
    const garden = getMyGarden();
    const list = document.getElementById('my-garden-list');
    const count = document.getElementById('garden-count');
    if (count) count.innerText = garden.length;
    
    // Update profile stats
    const profGarden = document.getElementById('prof-garden-count');
    if (profGarden) profGarden.innerText = garden.length;
    
    if (!list) return;

    if (garden.length === 0) {
        list.innerHTML = `
            <div class="garden-empty">
                <div style="font-size:48px; margin-bottom:12px;">🌱</div>
                <h3>Khu vườn trống</h3>
                <p>Quét nhận diện cây và bấm <strong>"🌿 Lưu vườn"</strong> để thêm cây vào đây!</p>
                <button class="btn btn-primary" onclick="switchTab('page-camera')" style="margin-top:16px;">📸 Quét cây ngay</button>
            </div>`;
        return;
    }

    list.innerHTML = `
        <div class="garden-stats-bar">
            <span>🌿 ${garden.length} loại cây</span>
        </div>
        <div class="garden-grid">
            ${garden.map((item, i) => `
                <div class="garden-card" onclick="viewGardenPlant(${i})">
                    <div class="garden-card-img">
                        ${item.image_url 
                            ? `<img src="${item.image_url}" alt="${item.name}" onerror="this.style.display='none'">` 
                            : `<div class="garden-card-placeholder">🌿</div>`
                        }
                    </div>
                    <div class="garden-card-body">
                        <h4 class="garden-card-name">${item.name}</h4>
                        <p class="garden-card-sci">${item.sci}</p>
                        <div class="garden-card-meta">
                            <span>📅 ${item.date}</span>
                            ${item.probability ? `<span>🎯 ${(item.probability * 100).toFixed(0)}%</span>` : ''}
                        </div>
                    </div>
                    <button class="garden-card-remove" onclick="event.stopPropagation(); removeFromGarden(${i})" title="Xóa">✕</button>
                </div>
            `).join('')}
        </div>`;
}

window.removeFromGarden = function(index) {
    if (!confirm('Bạn có chắc muốn xóa cây này khỏi khu vườn?')) return;
    const garden = getMyGarden();
    garden.splice(index, 1);
    saveMyGarden(garden);
    renderMyGarden();
};

// ═══ XEM CHI TIẾT CÂY TRONG VƯỜN ═══
window.viewGardenPlant = function(index) {
    const garden = getMyGarden();
    const plant = garden[index];
    if (!plant) return;
    
    const details = plant.details || {};
    const modal = document.getElementById('garden-detail-modal');
    if (!modal) return;
    
    document.getElementById('gd-name').innerText = plant.name;
    document.getElementById('gd-sci').innerText = plant.sci || '';
    document.getElementById('gd-date').innerText = `Nhận diện ngày ${plant.date}`;
    
    const imgEl = document.getElementById('gd-img');
    if (imgEl) {
        if (plant.image_url) {
            imgEl.src = plant.image_url;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }
    }
    
    // Probability
    const probEl = document.getElementById('gd-prob');
    const barEl = document.getElementById('gd-bar');
    if (probEl && plant.probability) {
        probEl.innerText = (plant.probability * 100).toFixed(2) + '%';
    }
    if (barEl && plant.probability) {
        barEl.style.width = (plant.probability * 100).toFixed(0) + '%';
    }
    
    // Details sections
    const safeSet = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text || 'N/A'; };
    
    safeSet('gd-desc', details.mo_ta);
    safeSet('gd-temp', details.nhiet_do);
    safeSet('gd-rain', details.luong_mua);
    safeSet('gd-time', details.thoi_gian_sinh_truong);
    safeSet('gd-family', details.ho);
    safeSet('gd-season', details.mua_vu);
    safeSet('gd-soil', details.dat);
    safeSet('gd-region', details.vung_trong);
    safeSet('gd-yield', details.san_luong_vn);
    safeSet('gd-story', details.cau_chuyen);
    safeSet('gd-tips', details.meo_trong_cay);
    safeSet('gd-use', details.ung_dung);
    safeSet('gd-nutrition', details.dinh_duong);
    
    // Bệnh hại
    const wList = document.getElementById('gd-warnings');
    if (wList) {
        if (details.warnings && details.warnings.length > 0) {
            wList.innerHTML = details.warnings.map(w => `<li>${w}</li>`).join('');
        } else {
            wList.innerHTML = '<li>Không có dữ liệu</li>';
        }
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeGardenDetail = function(e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById('garden-detail-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    renderMyGarden();

    // Nút Lưu Vườn
    const btnGarden = document.getElementById('btn-save-garden');
    if (btnGarden) {
        btnGarden.onclick = () => {
            if (!currentUser) {
                showToast("Vui lòng đăng nhập để lưu cây vào Khu Vườn!", "info");
                document.getElementById('auth-modal').style.display = 'flex';
                return;
            }
            if (!currentResult) return alert("Bạn chưa quét cây nào!");
            const details = currentResult.details || {};
            const garden = getMyGarden();

            const plantName = details.vi || currentResult.prediction;
            // Kiểm tra trùng
            const exists = garden.some(g => g.name === plantName);
            if (exists) return alert("Cây này đã có trong Khu Vườn rồi!");

            // Lấy ảnh từ preview
            let imageUrl = '';
            const previewEl = document.getElementById('preview-img');
            if (previewEl && previewEl.src && previewEl.style.display !== 'none') {
                imageUrl = previewEl.src;
            }
            // Fallback: ảnh healthy
            if (!imageUrl && details.healthy_img) {
                imageUrl = details.healthy_img;
            }

            garden.push({
                name: plantName,
                sci: details.ten_khoa_hoc || "N/A",
                date: new Date().toLocaleDateString('vi-VN'),
                prediction: currentResult.prediction,
                probability: currentResult.probability,
                image_url: imageUrl,
                details: {
                    mo_ta: details.mo_ta || '',
                    nhiet_do: details.nhiet_do || '',
                    luong_mua: details.luong_mua || '',
                    thoi_gian_sinh_truong: details.thoi_gian_sinh_truong || '',
                    ho: details.ho || '',
                    mua_vu: details.mua_vu || '',
                    dat: details.dat || '',
                    vung_trong: details.vung_trong || '',
                    san_luong_vn: details.san_luong_vn || '',
                    cau_chuyen: details.cau_chuyen || '',
                    meo_trong_cay: details.meo_trong_cay || '',
                    ung_dung: details.ung_dung || '',
                    dinh_duong: details.dinh_duong || '',
                    dieu_kien_van_hoa: details.dieu_kien_van_hoa || '',
                    warnings: details.warnings || [],
                    healthy_img: details.healthy_img || ''
                }
            });
            saveMyGarden(garden);
            renderMyGarden();
            alert("Đã lưu vào Khu Vườn Của Tôi! 🌿");
        };
    }

    // Nút hỏi AI về bệnh
    const btnAskDisease = document.getElementById('btn-ask-disease');
    if (btnAskDisease) {
        btnAskDisease.onclick = () => {
            if (!currentResult) return;
            // Mở chat window và tự gửi câu hỏi
            const chatWindow = document.getElementById('chat-window');
            if (chatWindow) chatWindow.style.display = 'flex';
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.value = "Cây " + (currentResult.details.vi || currentResult.prediction) + " bị bệnh gì và cách chữa trị?";
                const btnSend = document.getElementById('btn-send-chat');
                if (btnSend) btnSend.click();
            }
        };
    }
});

// ═══════════════════════════════════════════
// ═══ BOTTOM NAVIGATION TAB SWITCHING ══════
// ═══════════════════════════════════════════

const PAGE_TITLES = {
    'page-community': 'Cộng Đồng',
    'page-search': 'Tìm Kiếm',
    'page-camera': '📸 Máy Quét AI',
    'page-garden': 'Khu Vườn',
    'page-profile': 'Hồ Sơ'
};

function setupBottomNav() {
    const navButtons = document.querySelectorAll('.bnav-item');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            switchTab(page);
        });
    });

    // Encyc sub-tabs
    document.querySelectorAll('.encyc-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.encyc-pane').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
            document.querySelectorAll('.encyc-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const pane = document.getElementById(target);
            if (pane) { pane.style.display = 'block'; pane.classList.add('active'); }
        });
    });
}

window.switchTab = function(pageId) {
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
    
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
    
    const navBtn = document.querySelector(`.bnav-item[data-page="${pageId}"]`);
    if (navBtn) navBtn.classList.add('active');
    
    // Update header title
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = PAGE_TITLES[pageId] || 'CropSnap';

    // Load feed data if community
    if (pageId === 'page-community') fetchCommunityFeed();
    // Render garden if garden tab
    if (pageId === 'page-garden') renderMyGarden();
    // Update profile stats
    if (pageId === 'page-profile') updateProfileStats();
};

async function updateProfileStats() {
    if (!currentUser) return;

    // 1. Garden Count (from localStorage for now)
    const garden = getMyGarden();
    const profGarden = document.getElementById('prof-garden-count');
    if (profGarden) profGarden.innerText = garden.length;

    // 2. Scan Count (from scanHistory or fetch again)
    const profScan = document.getElementById('prof-scan-count');
    if (profScan) profScan.innerText = scanHistory.length;

    // 3. Post Count (Fetch from Backend API instead of Supabase since posts are local)
    const profPost = document.getElementById('prof-post-count');
    if (profPost) {
        try {
            const res = await fetch('/api/community/posts?email=' + encodeURIComponent(currentUser.email));
            const posts = await res.json();
            profPost.innerText = posts.length;
        } catch (e) { 
            console.error("Error fetching post count", e);
            profPost.innerText = "0"; 
        }
    }
}

// ═══ SEARCH ═══
window.searchCrop = async function(query) {
    const input = document.getElementById('search-input');
    if (input) input.value = query;
    const results = document.getElementById('search-results');
    if (!results) return;

    results.innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8;"><div style="font-size:24px;">🔄</div>Đang tìm kiếm...</div>';

    try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(query));
        const data = await res.json();
        
        if (data.length === 0) {
            results.innerHTML = `<div style="text-align:center; padding:40px; color:#94a3b8;">
                <div style="font-size:40px; margin-bottom:10px;">🔍</div>
                <p>Không tìm thấy "<strong>${query}</strong>"</p>
                <p style="font-size:12px; margin-top:6px;">Thử tìm: lúa, ngô, sắn, mía...</p>
            </div>`;
            return;
        }

        results.innerHTML = '';
        data.forEach(crop => {
            const card = document.createElement('div');
            card.className = 'search-result-card';
            card.innerHTML = `
                <div class="src-header">
                    <div class="src-icon">${crop.icon || '🌿'}</div>
                    <div class="src-title">
                        <h3>${crop.vi}</h3>
                        <span>${crop.en} · <em>${crop.sci_name}</em></span>
                    </div>
                </div>
                <p class="src-desc">${crop.description || 'Đang cập nhật mô tả...'}</p>
                ${crop.family ? `<div class="src-tags"><span class="src-tag">🏷️ ${crop.family}</span>${crop.temp ? `<span class="src-tag">🌡️ ${crop.temp}</span>` : ''}${crop.season ? `<span class="src-tag">📅 ${crop.season}</span>` : ''}</div>` : ''}
                ${crop.tips ? `<div class="src-section"><h4>🌱 Mẹo trồng</h4><p>${crop.tips}</p></div>` : ''}
                ${crop.warnings && crop.warnings.length ? `<div class="src-section src-warn"><h4>⚠️ Bệnh thường gặp</h4><ul>${crop.warnings.map(w => `<li>${w}</li>`).join('')}</ul></div>` : ''}
                ${crop.usage ? `<div class="src-section"><h4>🔨 Ứng dụng</h4><p>${crop.usage}</p></div>` : ''}
                ${crop.fun_fact ? `<div class="src-funfact">💡 ${crop.fun_fact}</div>` : ''}
            `;
            results.appendChild(card);
        });
    } catch (e) {
        results.innerHTML = '<p style="color:#ef4444; text-align:center;">Lỗi tìm kiếm.</p>';
    }
};

// Tìm kiếm khi gõ
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounce;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                const q = searchInput.value.trim();
                if (q.length >= 1) searchCrop(q);
                else document.getElementById('search-results').innerHTML = '';
            }, 400);
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchCrop(searchInput.value.trim());
        });
    }
});
