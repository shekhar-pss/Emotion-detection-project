# Emotion AI

Real-time facial emotion detection web app built with FastAPI + MobileNetV2.

## Stack

- **Backend**: FastAPI (Python)
- **Frontend**: Jinja2 templates, Vanilla CSS/JS
- **Model**: MobileNetV2 transfer learning (7 emotion classes)
- **Face Detection**: OpenCV Haar Cascade
- **Deployment**: Railway

## Emotions Detected

`Angry` · `Disgust` · `Fear` · `Happy` · `Neutral` · `Sad` · `Surprise`

## Local Development

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000

## Project Structure

```
emotion_ai/
├── app/
│   ├── main.py              # FastAPI app
│   ├── templates/
│   │   └── index.html       # Jinja2 template
│   └── static/
│       ├── style.css
│       ├── script.js
│       └── metrics.png
├── best_model.h5            # Trained model
├── requirements.txt
├── railway.toml
└── README.md
```

## Retraining

Run from the `train/` parent directory:

```bash
python run_project.py
```

Uses MobileNetV2 with two-phase transfer learning:
1. Train classifier head (base frozen)
2. Fine-tune top 30 layers of base
