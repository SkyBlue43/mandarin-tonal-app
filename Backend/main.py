from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
import parselmouth
import shutil, os, subprocess
import numpy as np
from textgrid import TextGrid

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


@app.post("/mfa/")
async def mfa(
    file: UploadFile = File(...),
    transcript: str = Form(...)
):
    filename_base = "sample"  # You can make dynamic later
    corpus_dir = "mfa_data/corpus"
    output_dir = "mfa_output"
    os.makedirs(corpus_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # Save original uploaded file
    input_path = "temp_input"
    output_audio_path = os.path.join(corpus_dir, f"{filename_base}.wav")
    output_text_path = os.path.join(corpus_dir, f"{filename_base}.txt")

    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Convert to mono 16kHz WAV
    audio = AudioSegment.from_file(input_path)
    audio = audio.set_channels(1)
    audio = audio.set_frame_rate(16000)
    audio = audio.normalize()
    audio.export(output_audio_path, format="wav")

    # Save transcript
    with open(output_text_path, "w", encoding="utf-8") as f:
        f.write(transcript.strip())

    # Run MFA alignment
    mfa_cmd = [
        "mfa", "align",
        corpus_dir,
        "mandarin_mfa",
        "mandarin_mfa",  # assumes you downloaded the pretrained 'mandarin' model
        output_dir,
        "--clean", "--overwrite"
    ]
    try:
        subprocess.run(mfa_cmd, check=True)
    except subprocess.CalledProcessError as e:
        return {"error": f"MFA failed: {str(e)}"}

    # Parse TextGrid output
    textgrid_path = os.path.join(output_dir, f"{filename_base}.TextGrid")
    if not os.path.exists(textgrid_path):
        return {"error": "Alignment failed — no TextGrid found"}

    tg = TextGrid.fromFile(textgrid_path)

    # Extract word/phoneme timing data
    results = {}
    for tier in tg:
        results[tier.name] = []
        for interval in tier.intervals:
            if interval.mark.strip():
                results[tier.name].append({
                    "start": interval.minTime,
                    "end": interval.maxTime,
                    "text": interval.mark
                })

    return {"alignment": results}