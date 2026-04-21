import os
import io
import base64
import numpy as np
import cv2
import uvicorn
from fastapi import FastAPI, File, UploadFile, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from tensorflow.keras.models import load_model
from PIL import Image
from pydantic import BaseModel
import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

app = FastAPI(title="Emotion AI")

CLASSES = ["Angry", "Disguist", "Fear", "Happy", "Neutral", "Sad", "Surprise"]
EMOJIS  = {"Angry":"😠","Disguist":"🤢","Fear":"😨","Happy":"😊","Neutral":"😐","Sad":"😢","Surprise":"😲"}

BASE_DIR   = os.path.dirname(__file__)
MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(BASE_DIR), "best_model.h5"))

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

# We serve the frontend Vite dist build folder
FRONTEND_DIST = os.path.join(BASE_DIR, "..", "frontend", "dist")

_model     = None
_img_size  = None

def get_model():
    global _model, _img_size
    if _model is None:
        _model    = load_model(MODEL_PATH)
        _img_size = (_model.input_shape[1], _model.input_shape[2])
    return _model, _img_size

MONGO_URI = os.environ.get("MONGO_URI")
db_client = AsyncIOMotorClient(MONGO_URI) if MONGO_URI else None
db = db_client.emotion_ai if db_client else None
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def log_user_emotion(username: str, ip: str, mode: str, emotion: str, confidence: float):
    if not db: return
    try:
        await db.logs.insert_one({
            "timestamp": datetime.datetime.now(),
            "username": username,
            "ip_address": ip,
            "mode": mode,
            "emotion": emotion,
            "confidence": confidence
        })
    except Exception as e:
        print("MongoDB Log error:", e)


class FrameData(BaseModel):
    image: str
    username: str = "guest"

class ChatMessage(BaseModel):
    message: str
    current_emotion: str
    username: str = "guest"

class LoginRequest(BaseModel):
    username: str
    password: str

class AdminRequest(BaseModel):
    admin_user: str
    admin_pass: str


def preprocess(pil_img: Image.Image, img_size: tuple) -> np.ndarray:
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    gray   = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    faces  = face_cascade.detectMultiScale(gray, 1.3, 5, minSize=(30, 30))

    if len(faces):
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        pad = int(max(w, h) * 0.15)
        x1, y1 = max(0, x - pad), max(0, y - pad)
        x2, y2 = min(cv_img.shape[1], x + w + pad), min(cv_img.shape[0], y + h + pad)
        region = cv2.cvtColor(cv_img[y1:y2, x1:x2], cv2.COLOR_BGR2RGB)
        face_found = True
    else:
        region     = np.array(pil_img)
        face_found = False

    arr = cv2.resize(region, img_size).astype("float32") / 255.0
    return np.expand_dims(arr, 0), face_found


def build_result(probs: np.ndarray, face_found: bool) -> dict:
    top_idx    = int(np.argmax(probs))
    all_scores = {CLASSES[i]: round(float(probs[i]) * 100, 1) for i in range(len(CLASSES))}
    all_scores = dict(sorted(all_scores.items(), key=lambda x: x[1], reverse=True))
    return {
        "emotion":      CLASSES[top_idx],
        "emoji":        EMOJIS.get(CLASSES[top_idx], ""),
        "confidence":   round(float(probs[top_idx]) * 100, 1),
        "all_scores":   all_scores,
        "face_detected": face_found,
    }


@app.get("/")
async def index():
    path = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(path):
        return FileResponse(path)
    return JSONResponse(status_code=404, content={"message": "Frontend not built yet. Run 'npm run build' inside frontend/ directory."})

@app.post("/predict")
async def predict(request: Request, file: UploadFile = File(...)):
    try:
        model, img_size = get_model()
        img             = Image.open(io.BytesIO(await file.read())).convert("RGB")
        arr, face_found = preprocess(img, img_size)
        probs           = model.predict(arr, verbose=0)[0]
        res             = build_result(probs, face_found)
        client_ip       = request.client.host if request.client else "unknown"
        await log_user_emotion("guest", client_ip, "upload", res["emotion"], res["confidence"])
        return JSONResponse(res)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/stream")
async def stream(request: Request, data: FrameData):
    try:
        encoded = data.image.split(",", 1)[-1]
        img     = Image.open(io.BytesIO(base64.b64decode(encoded))).convert("RGB")
        model, img_size = get_model()
        arr, face_found = preprocess(img, img_size)
        probs           = model.predict(arr, verbose=0)[0]
        res             = build_result(probs, face_found)
        client_ip       = request.client.host if request.client else "unknown"
        await log_user_emotion(data.username, client_ip, "stream", res["emotion"], res["confidence"])
        return JSONResponse({**res, "status": "success"})
    except Exception as exc:
        return JSONResponse({"emotion":"Error","emoji":"⚠️","confidence":0,
                             "all_scores":{},"face_detected":False,"status":"error","detail":str(exc)})


@app.post("/chat")
async def chat_bot(data: ChatMessage):
    emotion = data.current_emotion.lower()
    msg = data.message.lower()
    
    response = ""
    if "suggest" in msg or "advice" in msg or "help" in msg or "what" in msg:
        if emotion == "sad":
            response = "I noticed you might be feeling down. I suggest taking a 5-minute walk outside or listening to some uplifting music to refresh your mind."
        elif emotion == "angry":
            response = "You seem frustrated. Try the 4-7-8 breathing technique: inhale for 4 seconds, hold for 7, and exhale for 8 to calm your nervous system."
        elif emotion == "fear":
            response = "Feeling anxious? Try grounding yourself: name 5 things you can see, 4 you can touch, and 3 you can hear. You are safe."
        elif emotion == "disguist":
            response = "If you're feeling overwhelmed or uncomfortable, take a step back. Drink some cool water and get some fresh air."
        elif emotion == "happy":
            response = "You're feeling happy! That's excellent for your health. Maintain this by writing down one thing you're grateful for today."
        elif emotion == "surprise":
            response = "You look surprised! Take a deep breath to ground yourself and process the moment calmly."
        else:
            response = "To maintain good health: stay hydrated, ensure you get 8 hours of sleep, and take regular screen breaks."
    else:
        if emotion in ["sad", "angry", "fear", "disguist"]:
            response = f"I'm here for your wellness. I detect some '{emotion}'. Just ask me for 'suggestions' or 'advice' if you'd like to feel better!"
        else:
            response = "Hello! I'm your Wellness Assistant. Let me know if you need any health or mood-boosting suggestions!"

    return {"reply": response}


@app.post("/register")
async def register(data: LoginRequest):
    if not db:
        return JSONResponse(status_code=500, content={"success": False, "message": "MongoDB not configured yet. Server is running in stateless mode."})
    existing_user = await db.users.find_one({"username": data.username.lower()})
    if existing_user:
        return JSONResponse(status_code=400, content={"success": False, "message": "Username already taken."})
    
    hashed_pw = pwd_context.hash(data.password)
    await db.users.insert_one({"username": data.username.lower(), "password": hashed_pw, "created_at": datetime.datetime.now()})
    return {"success": True, "message": "Registration successful! You can now log in."}


@app.post("/login")
async def login(data: LoginRequest):
    # Demo Auth Override
    if data.username.lower() == "demo" and data.password == "demo":
        return {"success": True, "message": "Demo Login successful!", "username": "demo"}
    
    if not db:
        return JSONResponse(status_code=500, content={"success": False, "message": "MongoDB not configured. Use 'demo' / 'demo' instead."})
        
    user = await db.users.find_one({"username": data.username.lower()})
    if not user or not pwd_context.verify(data.password, user["password"]):
        return JSONResponse(status_code=401, content={"success": False, "message": "Invalid password or username."})
        
    return {"success": True, "message": f"Welcome back, {user['username']}!", "username": user["username"]}


@app.get("/api/history/{username}")
async def user_history(username: str):
    if not db: return JSONResponse(status_code=200, content=[])
    cursor = db.logs.find({"username": username}).sort("timestamp", -1).limit(60)
    logs = await cursor.to_list(length=60)
    
    # process for fast-charts
    res = []
    for l in logs:
        l["_id"] = str(l["_id"])
        l["timestamp"] = l["timestamp"].strftime("%Y-%m-%d %H:%M:%S") if "timestamp" in l else "Unknown"
        res.append(l)
    return res


@app.post("/api/admin/stats")
async def admin_stats(data: AdminRequest):
    if data.admin_user.lower() != "admin":
        return JSONResponse(status_code=403, content={"message": "Forbidden. Admin access required."})
    
    if db:
        user = await db.users.find_one({"username": data.admin_user.lower()})
        if user and not pwd_context.verify(data.admin_pass, user["password"]):
            return JSONResponse(status_code=401, content={"message": "Invalid admin password."})
        elif not user and data.admin_pass != "admin":
            return JSONResponse(status_code=401, content={"message": "Invalid demo admin password."})
            
        users_ret = []
        all_users = await db.users.find({}).to_list(length=100)
        total_logs = await db.logs.count_documents({})
        for u in all_users:
            uname = u["username"]
            c = await db.logs.count_documents({"username": uname})
            users_ret.append({
                "username": uname,
                "created_at": u.get("created_at", datetime.datetime.now()).strftime("%Y-%m-%d"),
                "log_count": c
            })
        return {"success": True, "users": users_ret, "total_logs": total_logs}
    
    return {"success": True, "users": [{"username": "demo", "created_at": "Today", "log_count": 0}], "total_logs": 0}


@app.post("/api/admin/delete/{target}")
async def admin_delete(target: str, data: AdminRequest):
    if data.admin_user.lower() != "admin": return JSONResponse(status_code=403, content={"message": "Forbidden."})
    if db:
        await db.users.delete_one({"username": target})
        await db.logs.delete_many({"username": target})
    return {"success": True}


@app.get("/health")
async def health():
    return {"status": "ok"}

# Mount the rest of the React static assets natively at the root
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST), name="static")

if __name__ == "__main__":
    get_model()
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
