from gtts import gTTS
from playsound import playsound

# Text to synthesize
text = "你好！欢迎来到语音练习。"
text2 = "Hello there"
text3 = "Sou muito grato para você"

# Create TTS object with Chinese language
tts = gTTS(text=text, lang='zh')
tts2 = gTTS(text=text2, lang="en")
tts3 = gTTS(text=text3, lang='pt')

# Save the synthesized speech to a file
tts.save("chinese_output.mp3")
tts2.save("english_output.mp3")
tts3.save("portuguese_output.mp3")

# Play the audio file
playsound("chinese_output.mp3")
