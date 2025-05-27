from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import parselmouth
import shutil
import os
import tempfile


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # or "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze-audio/")
async def analyze_audio(file: UploadFile = File(...)):
    with open("temp.wav", "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    sound = parselmouth.Sound("temp.wav")
    pitch = sound.to_pitch()

    pitch_values = []
    for i in range(pitch.get_number_of_frames()):
        time = pitch.get_time_from_frame_number(i + 1)
        freq = pitch.get_value_in_frame(i + 1)
        pitch_values.append({"time": time, "frequency": freq})

    return {"pitch": pitch_values}
