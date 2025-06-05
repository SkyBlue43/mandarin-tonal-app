from fastapi import FastAPI, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
import parselmouth
import shutil
import os
import numpy as np
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
import json

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


def normalize(pitch):
    min_p = min(pitch)
    max_p = max(pitch)
    if max_p == min_p:
        return [0.5 for _ in pitch]
    return [(p - min_p) / (max_p - min_p) for p in pitch]


@app.post("/dtw/")
async def dtw(
    data_reference: str = Form(...),
    data_user: str = Form(...)
):
    reference_data = json.loads(data_reference)
    user_data = json.loads(data_user)

    ref_pitch = normalize(reference_data["frequency"])
    user_pitch = normalize(user_data["frequency"])

    ref_tuples = list(zip(ref_pitch))
    user_tuples = list(zip(user_pitch))

    distance, path = fastdtw(ref_tuples, user_tuples, dist=euclidean)

    # Build aligned output using path indices
    aligned_ref = [reference_data["frequency"][i] for i, _ in path]
    aligned_user = [user_data["frequency"][j] for _, j in path]

    # Optional: make up a fake time axis just for plotting
    time_axis = list(range(len(path)))

    aligned_points = [
        {"time": t, "reference": ref, "user": user}
        for t, ref, user in zip(time_axis, aligned_ref, aligned_user)
    ]

    return {
        "distance": distance,
        "aligned": aligned_points
    }