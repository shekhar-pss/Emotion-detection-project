# EmotionTracker - Technical Project Report

## 1. Project Overview
EmotionTracker is a full-stack web application designed to detect and log human emotions in real-time. It uses a custom-trained machine learning model based on MobileNetV2 for facial emotion recognition, a FastAPI backend for high-performance request handling, and a modern React (Vite) frontend for a responsive user experience. 

The primary goal of this platform is to provide users with a tool to track their daily emotional well-being and receive helpful wellness suggestions from an integrated chat assistant.

## 2. Technical Stack
- **Frontend**: React.js (built with Vite), Vanilla CSS (for glassmorphism UI styling).
- **Backend / API**: FastAPI (Python), Uvicorn.
- **Machine Learning**: TensorFlow (MobileNetV2 architecture), OpenCV (Haarcascade for face detection).
- **Database**: MongoDB Atlas (accessed via `motor` asynchronously) for user authentication and historical log storage.
- **Authentication**: `passlib` (bcrypt) for secure password hashing.
- **Hosting / Deployment**: Railway (Nixpacks build).

## 3. Core Features
- **Real-Time Video Stream Analysis**: Users can use their webcam to stream frames to the server. The server processes the images via OpenCV and TensorFlow, returning the detected emotion and confidence score instantly.
- **Image Upload**: Users can manually upload static images for analysis.
- **Authentication System**: Full registration and login flow mapping directly to MongoDB users.
- **Wellness Assistant**: A built-in chatbot that reads the user's currently detected emotion and offers context-aware advice (e.g., suggesting a walk if the user is sad).
- **Dashboard & Analytics**: A chronological heatmap (similar to version control contribution graphs) displaying past emotional states.
- **Admin Panel**: An exclusive dashboard available only to the `"admin"` account, visualizing total platform queries and allowing the deletion of user accounts.

## 4. Architecture & Data Flow
1. **Client -> Server**: The React application captures a video frame (via HTML5 Canvas) or image file and sends a POST request to `/predict` or `/stream` containing base64 data.
2. **Preprocessing**: FastAPI receives the payload, converts it into a NumPy array, and utilizes OpenCV to isolate the bounding box of the face.
3. **Inference**: The cropped face is passed into the frozen MobileNetV2 `h5` model to yield an array of 7 emotion probabilities (Angry, Disgust, Fear, Happy, Neutral, Sad, Surprise).
4. **Logging**: The prediction, timestamp, and active user session are asynchronously pushed into the `logs` collection in MongoDB Atlas.
5. **Server -> Client**: The JSON response updates the React state to show the live metrics and log history to the user.

## 5. Potential Future Enhancements
- Transition from HTTP REST polling to WebSockets for live video streaming to significantly reduce latency.
- Integrate a real large language model (LLM) API like OpenAI to provide more dynamic and conversational wellness support.
- Implement JWT token-based authentication instead of the current stateful session validation technique.
