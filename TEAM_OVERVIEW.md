# EmotionTracker - Team Overview

## Project Background
This document outlines the contributions and responsibilities of our 10-person development team. Over the course of the project lifecycle, our group was split into three main divisions: Machine Learning & Data, Backend Infrastructure, and Frontend/UI Experience.

## Team Roles and Responsibilities

### Machine Learning & Data Team
**1. Lead Machine Learning Engineer**
- **Responsibilities:** Led the design of the MobileNetV2 architecture. Decided on the two-phase transfer learning approach (frozen base followed by fine-tuning) to prevent overfitting on the original dataset.

**2. Data Scientist**
- **Responsibilities:** Handled data collection, cleaning, and augmentation using `ImageDataGenerator`. Evaluated the model's accuracy, constructed the confusion matrices, and optimized the dataset balancing across the 7 emotion categories.

**3. Computer Vision Specialist**
- **Responsibilities:** Integrated the OpenCV Haarcascade classifier within the Python application. Ensured that faces are properly cropped and scaled to 224x224 pixels before being passed to the prediction model.

### Backend Infrastructure Team
**4. Lead Backend Engineer**
- **Responsibilities:** Structured the FastAPI application. Developed the main `app/main.py` routing logic, handling multipart form file uploads, base64 image decoding, and CORS configuration.

**5. Database Architect**
- **Responsibilities:** Setup and managed the MongoDB Atlas cluster. Integrated the asynchronous `motor` driver into the backend safely to ensure fast query times for user logs and analytical data.

**6. Cloud DevOps & Security Engineer**
- **Responsibilities:** Managed the CI/CD pipeline and deployment on Railway. Added `passlib` bcrypt hashing for the registration endpoints, managed environment variables safely, and configured Nixpacks in `railway.toml`.

### Frontend & UI Experience Team
**7. Lead Frontend Developer**
- **Responsibilities:** Scaffolding and structuring the React (Vite) application inside the `/frontend` directory. Built the core `App.jsx` layout, routing, state management, and the fetch logic connecting to the API.

**8. UI/UX Designer**
- **Responsibilities:** Designed the "Dark Glassmorphism" aesthetic. Dictated the CSS class structures, animations (fade-ins, scan-lines), and modal interactions. Handled the mobile-responsive formatting.

**9. Full-Stack / Integrations Developer**
- **Responsibilities:** Built out the "Wellness Assistant" logic, linking the frontend chat interface to the backend condition-based suggestion rules. Wired up the chronological Heatmap to properly map data from MongoDB.

**10. Quality Assurance (QA) & Project Manager**
- **Responsibilities:** Orchestrated sprint planning, conducted thorough integration testing across both frontend validation and backend authentication, and maintained all final repository documentation (`PROJECT_REPORT.md` and this overview).
