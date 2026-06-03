// --- SUPABASE AUTH CONFIG ---
const SUPABASE_URL = "https://kbdbvakemunkuprohucw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiZGJ2YWtlbXVua3Vwcm9odWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjE0MDMsImV4cCI6MjA5MjMzNzQwM30.66zFR03s8AUn8TTdDoYjLh7z_qeN54vJ_kLDijMxAkQ";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// --- AUDIO ENGINE ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, type, duration) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// --- DOM ELEMENTS ---
const btnCamera = document.getElementById('btn-camera');
const btnCapture = document.getElementById('btn-capture');
const fileUpload = document.getElementById('file-upload');
const video = document.getElementById('camera-stream');
const imgPreview = document.getElementById('preview-img');
const heatmapImg = document.getElementById('heatmap-img');
const canvas = document.getElementById('hidden-canvas');
const scannerBox = document.getElementById('scanner-box');
const radarAnim = document.getElementById('radar-animation');
const overlay = document.getElementById('loading-overlay');
const placeholder = document.getElementById('placeholder-text');

let stream = null;
let scanHistory = [];

// --- AUTH LOGIC ---
async function checkUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    updateAuthUI(user);
    if (user) currentUser = user;
}

function updateAuthUI(user) {
    const userInfo = document.getElementById('user-info');
    const btnShowLogin = document.getElementById('btn-show-login');
    const userName = document.getElementById('user-name');
    if (user) {
        userInfo.classList.remove('hidden');
        btnShowLogin.classList.add('hidden');
        userName.innerText = user.email.split('@')[0];
    } else {
        userInfo.classList.add('hidden');
        btnShowLogin.classList.remove('hidden');
    }
}

function initAuth() {
    const authModal = document.getElementById('auth-modal');
    const btnShowLogin = document.getElementById('btn-show-login');
    const btnCloseModal = document.querySelector('.close-modal');
    const authForm = document.getElementById('auth-form');
    const authSwitchLink = document.getElementById('auth-switch-link');
    let isLoginMode = true;

    if (btnShowLogin) btnShowLogin.onclick = () => authModal.classList.remove('hidden');
    if (btnCloseModal) btnCloseModal.onclick = () => authModal.classList.add('hidden');
    if (authSwitchLink) {
        authSwitchLink.onclick = (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            document.getElementById('auth-title').innerText = isLoginMode ? "Chào mừng trở lại" : "Tạo tài khoản mới";
            document.getElementById('btn-auth-submit').innerText = isLoginMode ? "Đăng nhập" : "Đăng ký";
            authSwitchLink.innerText = isLoginMode ? "Đăng ký ngay" : "Đăng nhập";
        };
    }
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            try {
                if (isLoginMode) {
                    await supabaseClient.auth.signInWithPassword({ email, password });
                    alert("Đăng nhập thành công!");
                } else {
                    await supabaseClient.auth.signUp({ email, password });
                    alert("Đăng ký thành công! Hãy kiểm tra email.");
                }
                authModal.classList.add('hidden');
                checkUser();
            } catch (err) { alert(err.message); }
        };
    }
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = () => { supabaseClient.auth.signOut(); location.reload(); };
}

// --- INIT APP ---
function init() {
    initAuth();
    checkUser();
    fetchHistory();

    const splash = document.getElementById('splash-screen');
    const btnContinue = document.getElementById('btn-continue');
    
    if (btnContinue && splash) {
        btnContinue.addEventListener('click', () => {
            initAudio();
            playTone(800, 'sine', 0.2);
            splash.classList.add('fade-out');
            setTimeout(() => { splash.style.display = 'none'; }, 800);
        });
    }
}

// Khởi chạy
document.addEventListener('DOMContentLoaded', init);
