from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
import parselmouth
import numpy as np
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
import json
import shutil, os, subprocess
from textgrid import TextGrid
import whisper
from faster_whisper import WhisperModel

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








# Using this for voiceless testing


@app.post("/analyze-audio-voiceless/")
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
        if not np.isnan(freq) and freq > 0:
            semitone = 12 * np.log2(freq)
            pitch_values.append({"time": time, "frequency": semitone})
        else:
            pitch_values.append({"time": time, "frequency": None})  # or null in JSON


    os.remove(input_path)
    os.remove(output_path)

    return {"pitch": pitch_values}


# REWRITE THIS CODE!!!
def safe_mean(arr, default=0.0):
    """Mean of valid numbers only."""
    valid = [x for x in arr if x is not None and not np.isnan(x) and not np.isinf(x)]
    return np.mean(valid) if valid else default

# ---- Endpoint ----

@app.post("/dtw-voiceless/")
async def dtw(
    data_reference: str = Form(...),
    data_user: str = Form(...)
):
    reference_data = json.loads(data_reference)
    user_data = json.loads(data_user)

    # Normalize and keep indices
    def normalize_with_index(pitch):
        valid = [(i, p) for i, p in enumerate(pitch) if p is not None and not np.isnan(p) and not np.isinf(p)]
        if not valid:
            return [], {}
        min_p = min(p for _, p in valid)
        max_p = max(p for _, p in valid)
        if min_p == max_p:
            normed = [(i, 0.5) for i, _ in valid]
        else:
            normed = [(i, (p - min_p) / (max_p - min_p)) for i, p in valid]
        return [v for _, v in normed], {idx: v for idx, v in normed}

    norm_ref, norm_ref_map = normalize_with_index(reference_data["frequency"])
    norm_user, norm_user_map = normalize_with_index(user_data["frequency"])

    ref_tuples = [(v,) for v in norm_ref]
    user_tuples = [(v,) for v in norm_user]

    if not ref_tuples or not user_tuples:
        raise HTTPException(status_code=400, detail="Pitch data too sparse after cleaning.")

    # DTW alignment using original indices
    distance, path = fastdtw(ref_tuples, user_tuples, dist=euclidean)

    # Reverse the index map to actual positions
    ref_keys = list(norm_ref_map.keys())
    user_keys = list(norm_user_map.keys())

    user_aligned = {}
    for i, j in path:
        ref_idx = ref_keys[i]
        user_idx = user_keys[j]
        val = user_data["frequency"][user_idx]
        if ref_idx not in user_aligned:
            user_aligned[ref_idx] = []
        if val is not None and not np.isnan(val) and not np.isinf(val):
            user_aligned[ref_idx].append(val)

    # Build aligned points
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

    # Vertical shift
    ref_mean = safe_mean(reference_data["frequency"])
    user_mean = safe_mean([pt["user"] for pt in aligned_points])
    shift = ref_mean - user_mean

    for pt in aligned_points:
        if pt["user"] is not None:
            pt["user"] += shift

    return {
        "distance": distance,
        "aligned": aligned_points
    }



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



# using this for the new dtw/MFA/voiceless combination

@app.post('/transcribe/')
async def transcribe(
    file: UploadFile= File(...)
):
    temp_path = "temp.wav"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    # model = whisper.load_model("base")  # You can try "tiny", "base", "small", "medium", "large"

    # result = model.transcribe(temp_path, language="zh", initial_prompt='你好！你今天怎么样？')

    model = WhisperModel("base", device="cpu", compute_type="int8")  # 'cuda' if on GPU

    segments, info = model.transcribe(temp_path, word_timestamps=True, initial_prompt="你好，你今天怎么样？")


    return segments


@app.post("/dtw_new/")
async def dtw_new(
    reference_pitch: str = Form(...),
    user_pitch: str = Form(...)
):
    reference_pitch = json.loads(reference_pitch)
    user_pitch = json.loads(user_pitch)
    
    model = whisper.load_model("base")  # You can try "tiny", "base", "small", "medium", "large"

    result = model.transcribe("your_audio_file.wav")  # .mp3/.m4a/.webm also supported

    for segment in result['segments']:
        print(f"[{segment['start']:.2f}s - {segment['end']:.2f}s] {segment['text']}")
