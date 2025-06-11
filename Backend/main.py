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
        if np.isnan(freq) or freq <= 0:
            semitone = 0  # or np.nan if you'd prefer to omit unvoiced parts
        else:
            semitone = 12 * np.log2(freq)
            pitch_values.append({"time": time, "frequency": semitone})

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

    # Calculate DTW path
    distance, path = fastdtw(ref_tuples, user_tuples, dist=euclidean)

    # Create dict to map ref index to list of user frequencies that match
    user_aligned = {}
    for i, j in path:
        if i not in user_aligned:
            user_aligned[i] = []
        user_aligned[i].append(user_data["frequency"][j])

    # Average user values at each reference point
    aligned_points = []
    for i, ref_freq in enumerate(reference_data["frequency"]):
        time = reference_data["time"][i]
        user_vals = user_aligned.get(i, [])
        user_freq = np.mean(user_vals) if user_vals else None
        aligned_points.append({
            "time": time,
            "reference": ref_freq,
            "user": user_freq
        })

    valid_user_freqs = [pt["user"] for pt in aligned_points if pt["user"] is not None]
    if valid_user_freqs:
        ref_mean = np.mean(reference_data['frequency'])
        user_mean = np.mean(valid_user_freqs)
        shift = ref_mean - user_mean

        for pt in aligned_points:
            if pt["user"] is not None:
                pt["user"] += shift

    return {
        "distance": distance,
        "aligned": aligned_points
    }
