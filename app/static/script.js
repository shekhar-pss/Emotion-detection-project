const EMOJIS = {
    Angry:"😠", Disguist:"🤢", Fear:"😨",
    Happy:"😊", Neutral:"😐", Sad:"😢", Surprise:"😲"
};

const el = id => document.getElementById(id);

const tabUpload    = el("tabUpload");
const tabLive      = el("tabLive");
const tabProfile   = el("tabProfile");
const tabIndicator = el("tabIndicator");
const secUpload    = el("sectionUpload");
const secLive      = el("sectionLive");
const secProfile   = el("sectionProfile");

const chatMessages = el("chatMessages");
const chatInput    = el("chatInput");
const btnSend      = el("btnSend");

const authForm     = el("authForm");
const authUser     = el("authUsername");
const authPass     = el("authPassword");
const authError    = el("authError");
const authModal    = el("authModal");
const authRegister = el("authRegister");
const mainApp      = el("mainApp");

const dropzone     = el("dropzone");
const dzIdle       = el("dropzoneIdle");
const fileInput    = el("fileInput");
const preview      = el("preview");
const btnClear     = el("btnClear");
const btnAnalyze   = el("btnAnalyze");
const analyzeLabel = el("analyzeLabel");

const webcam       = el("webcam");
const canvas       = el("canvas");
const btnCamera    = el("btnCamera");
const cameraLabel  = el("cameraLabel");
const scanLine     = el("scanLine");
const liveBadge    = el("liveBadge");
const liveEmoji    = el("liveEmoji");
const liveLabel    = el("liveLabel");
const liveConf     = el("liveConf");
const liveConfVal  = el("liveConfVal");
const noCamMsg     = el("noCamMsg");

const resultsPanel = el("resultsPanel");
const resultEmoji  = el("resultEmoji");
const resultEmotion= el("resultEmotion");
const confBarFill  = el("confBarFill");
const confText     = el("confText");
const faceTag      = el("faceTag");
const allScores    = el("allScores");

const modal        = el("modal");
const modalBackdrop= el("modalBackdrop");
const btnMetrics   = el("btnMetrics");
const btnModalClose= el("btnModalClose");

let streaming    = false;
let loopTimer    = null;
let activeFile   = null;
let lastEmotion  = "neutral";
let currentUser  = "guest";

function switchTab(mode) {
    [tabUpload, tabLive, tabProfile].forEach(t => t.classList.remove("active"));
    [secUpload, secLive, secProfile].forEach(s => s.classList.add("hidden"));
    tabIndicator.className = "tab-indicator"; // reset classes
    resultsPanel.classList.add("hidden");

    if (mode === "upload") {
        tabUpload.classList.add("active");
        secUpload.classList.remove("hidden");
        stopCamera();
    } else if (mode === "live") {
        tabLive.classList.add("active");
        tabIndicator.classList.add("center");
        secLive.classList.remove("hidden");
    } else if (mode === "profile") {
        tabProfile.classList.add("active");
        tabIndicator.classList.add("right");
        secProfile.classList.remove("hidden");
        stopCamera();
    }
}

tabUpload.addEventListener("click",  () => switchTab("upload"));
tabLive.addEventListener("click",    () => switchTab("live"));
tabProfile.addEventListener("click", () => switchTab("profile"));

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = authUser.value.trim();
    const password = authPass.value;
    
    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
            currentUser = data.username || "guest";
            authModal.style.opacity = "0";
            authModal.style.pointerEvents = "none";
            mainApp.style.opacity = "1";
            mainApp.style.pointerEvents = "auto";
            setTimeout(() => authModal.remove(), 500);
        } else {
            authError.style.color = "var(--danger)";
            authError.textContent = data.message || "Invalid credentials.";
            authError.classList.remove("hidden");
        }
    } catch {
        authError.style.color = "var(--danger)";
        authError.textContent = "Network error. Server offline?";
        authError.classList.remove("hidden");
    }
});

authRegister.addEventListener("click", async () => {
    const username = authUser.value.trim();
    const password = authPass.value;
    if (!username || !password) {
        authError.style.color = "var(--danger)";
        authError.textContent = "Enter both username and password.";
        authError.classList.remove("hidden");
        return;
    }
    
    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        authError.style.color = data.success ? "var(--success)" : "var(--danger)";
        authError.textContent = data.message;
        authError.classList.remove("hidden");
    } catch {
        authError.style.color = "var(--danger)";
        authError.textContent = "Network error.";
        authError.classList.remove("hidden");
    }
});

["dragenter","dragover"].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault(); dropzone.classList.add("drag-over");
}));
["dragleave","drop"].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault(); dropzone.classList.remove("drag-over");
}));

dropzone.addEventListener("drop", e => {
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) loadFile(f);
});
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => { if (e.target.files[0]) loadFile(e.target.files[0]); });

function loadFile(file) {
    activeFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        preview.src = e.target.result;
        preview.classList.remove("hidden");
        dzIdle.style.opacity = "0";
        dzIdle.style.pointerEvents = "none";
        dropzone.classList.add("has-image");
        btnClear.classList.remove("hidden");
        btnAnalyze.disabled = false;
        resultsPanel.classList.add("hidden");
    };
    reader.readAsDataURL(file);
}

btnClear.addEventListener("click", e => {
    e.stopPropagation();
    activeFile = null;
    fileInput.value = "";
    preview.src = "";
    preview.classList.add("hidden");
    dzIdle.style.opacity = "1";
    dzIdle.style.pointerEvents = "auto";
    dropzone.classList.remove("has-image");
    btnClear.classList.add("hidden");
    btnAnalyze.disabled = true;
    resultsPanel.classList.add("hidden");
});

btnAnalyze.addEventListener("click", async () => {
    if (!activeFile) return;
    btnAnalyze.disabled = true;
    analyzeLabel.innerHTML = '<div class="spinner"></div> Analyzing...';
    try {
        const fd = new FormData();
        fd.append("file", activeFile);
        const res = await fetch("/predict", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok) renderResults(data);
        else alert("Error: " + (data.detail || "Unknown error"));
    } catch (err) {
        alert("Network error: " + err.message);
    } finally {
        btnAnalyze.disabled = false;
        analyzeLabel.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Analyze Emotion';
    }
});

function renderResults(data) {
    if(data.face_detected) lastEmotion = data.emotion;
    
    resultEmoji.textContent  = data.emoji || "🤔";
    resultEmotion.textContent = data.emotion;
    confBarFill.style.width  = data.confidence + "%";
    confText.textContent     = data.confidence + "%";

    faceTag.textContent = data.face_detected ? "Face Detected" : "No Face (Full Image)";
    faceTag.className   = "tag " + (data.face_detected ? "tag-success" : "tag-warn");

    allScores.innerHTML = "";
    let first = true;
    for (const [emotion, pct] of Object.entries(data.all_scores || {})) {
        const row = document.createElement("div");
        row.className = "score-row" + (first ? " top" : "");
        row.innerHTML = `
            <div class="label"><span>${EMOJIS[emotion]||""}</span>${emotion}</div>
            <div class="bar-bg"><div class="bar" style="width:0%"></div></div>
            <div class="val">${pct}%</div>
        `;
        allScores.appendChild(row);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            row.querySelector(".bar").style.width = pct + "%";
        }));
        first = false;
    }

    resultsPanel.classList.remove("hidden");
    resultsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

btnCamera.addEventListener("click", () => { if (streaming) stopCamera(); else startCamera(); });

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode:"user", width:{ideal:640}, height:{ideal:480} }
        });
        webcam.srcObject = stream;
        streaming = true;
        noCamMsg.classList.add("hidden");
        scanLine.classList.remove("hidden");
        liveConf.classList.remove("hidden");
        cameraLabel.textContent = "Stop Camera";
        btnCamera.className = "btn btn-danger";
        loopTimer = setInterval(sendFrame, 500);
    } catch (err) {
        alert("Camera denied: " + err.message);
    }
}

function stopCamera() {
    webcam.srcObject?.getTracks().forEach(t => t.stop());
    webcam.srcObject = null;
    streaming = false;
    clearInterval(loopTimer);
    loopTimer = null;
    noCamMsg.classList.remove("hidden");
    scanLine.classList.add("hidden");
    liveConf.classList.add("hidden");
    cameraLabel.textContent = "Start Camera";
    btnCamera.className = "btn btn-primary";
    liveEmoji.textContent = "😐";
    liveLabel.textContent = "Ready";
    liveConfVal.textContent = "—";
}

async function sendFrame() {
    if (!streaming || !webcam.videoWidth) return;
    canvas.width  = webcam.videoWidth;
    canvas.height = webcam.videoHeight;
    canvas.getContext("2d").drawImage(webcam, 0, 0);
    const b64 = canvas.toDataURL("image/jpeg", 0.6);
    try {
        const res  = await fetch("/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: b64, username: currentUser })
        });
        const data = await res.json();
        if (data.status === "success") {
            lastEmotion              = data.emotion;
            liveEmoji.textContent    = data.emoji || "🤔";
            liveLabel.textContent    = data.emotion;
            liveConfVal.textContent  = data.confidence + "%";
        } else {
            liveEmoji.textContent  = "👀";
            liveLabel.textContent  = "No face";
            liveConfVal.textContent = "—";
        }
    } catch {}
}

function addChatMessage(sender, text) {
    const el = document.createElement("div");
    el.className = "msg " + sender;
    el.textContent = text;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

btnSend.addEventListener("click", async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    
    addChatMessage("user", text);
    chatInput.value = "";
    btnSend.disabled = true;

    try {
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, current_emotion: lastEmotion, username: currentUser })
        });
        const data = await res.json();
        addChatMessage("bot", data.reply || "Sorry, I couldn't understand that.");
    } catch (e) {
        addChatMessage("bot", "Network error. Please try again.");
    } finally {
        btnSend.disabled = false;
        chatInput.focus();
    }
});

chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") btnSend.click();
});

btnMetrics.addEventListener("click",   () => modal.classList.remove("hidden"));
btnModalClose.addEventListener("click",() => modal.classList.add("hidden"));
modalBackdrop.addEventListener("click",() => modal.classList.add("hidden"));
document.addEventListener("keydown", e => { if (e.key === "Escape") modal.classList.add("hidden"); });
