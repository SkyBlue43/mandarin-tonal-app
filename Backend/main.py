from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
import parselmouth
import shutil
import os
import numpy as np

app = FastAPI()

# CORS: allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze-audio/")
async def analyze_audio(file: UploadFile = File(...)):
    input_path = "temp_input"
    output_path = "temp.wav"

    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    audio = AudioSegment.from_file(input_path)
    audio.export(output_path, format="wav")

    sound = parselmouth.Sound(output_path)
    pitch = sound.to_pitch()

    pitch_values = []
    for i in range(pitch.get_number_of_frames()):
        time = pitch.get_time_from_frame_number(i + 1)
        freq = pitch.get_value_in_frame(i + 1)
        if np.isnan(freq):
            freq = 0
        else:
            pitch_values.append({"time": time, "frequency": freq})

    os.remove(input_path)
    os.remove(output_path)

    return {"pitch": pitch_values}

