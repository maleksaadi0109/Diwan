#!/usr/bin/env python3
"""
Generates real audio recordings for the bundled sample poems.
Uses edge-tts (Arabic neural voice) if available, or gTTS, or ffmpeg tone.
"""

import os
import sys
import subprocess
import asyncio

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "recordings")
os.makedirs(OUTPUT_DIR, exist_ok=True)

POEMS_AUDIO = [
    {
        "filename": "mutanabbi_waharra.mp3",
        "text": """
        واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم
        ما لي أكتم حبا قد برى جسدي وتدعي حب سيف الدولة الأمم
        إن كان يجمعنا حب لغرته فليت أنا بقدر الحب نقتسم
        قد زرته وسيوف الهند مغمدة وقد نظرت إليه والسيوف دم
        فكان أحسن خلق الله كلهم وكان أحسن ما في الأحسن الشيم
        فوت العدو الذي يممته ظفر في طيه ظفر في طيه ندم
        قد ناب عنك شديد الخوف واصطنعت لك المهابة ما لا تصنع البهم
        ألزمت نفسك شيئا لم يقم به أحد وأتعبت في أفكارك الفكر
        يا أعدل الناس إلا في معاملتي فيك الخصام وأنت الخصم والحكم
        أعيذها نظرات منك صادقة أن تحسب الشحم فيمن شحمه ورم
        """,
    },
    {
        "filename": "imru_alqais.mp3",
        "text": """
        قفا نبك من ذكرى حبيب ومنزل بسقط اللوى بين الدخول فحومل
        فتوضح فالمقراة لم يعف رسمها لما نسجتها من جنوب وشمأل
        ترى بعر الآرام في عرصاتها وقيعانها كأنه حب فلفل
        كأني غداة البين يوم تحملوا لدى سمرات الحي ناقف حنظل
        """,
    },
    {
        "filename": "abu_firas.mp3",
        "text": """
        أراك عصي الدمع شيمتك الصبر أما للهوى نهي عليك ولا أمر
        بلى أنا مشتاق وعندي لوعة ولكن مثلي لا يذاع له سر
        إذا الليل أضواني بسطت يد الهوى وأذللت دمعا من خلائقه الكبر
        تكاد تضيء النار بين جوانحي إذا هي أذكتها الصبابة والفكر
        """,
    },
]

async def generate_with_edge_tts(text: str, out_path: str):
    import edge_tts
    communicate = edge_tts.Communicate(text, "ar-SA-HamedNeural", rate="-10%")
    await communicate.save(out_path)

def generate_fallback_ffmpeg(out_path: str, duration_sec: int = 45):
    # Generates a pleasant soft melody audio so it plays and synchronizes cleanly
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", f"sine=frequency=220:duration={duration_sec}",
        "-af", "volume=0.25,lowpass=f=1000",
        "-c:a", "libmp3lame",
        out_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

async def main():
    print("Generating sample audio recordings...")
    for item in POEMS_AUDIO:
        out_file = os.path.join(OUTPUT_DIR, item["filename"])
        print(f"Generating: {item['filename']}...")
        try:
            await generate_with_edge_tts(item["text"], out_file)
            print(f"  ✓ Successfully generated with Arabic Neural Voice: {out_file}")
        except Exception as e:
            print(f"  Edge TTS not available ({e}), creating tone fallback...")
            try:
                from gtts import gTTS
                tts = gTTS(text=item["text"], lang="ar")
                tts.save(out_file)
                print(f"  ✓ Generated with gTTS: {out_file}")
            except Exception as e2:
                print(f"  gTTS not available ({e2}), generating audio via ffmpeg...")
                generate_fallback_ffmpeg(out_file, 50)
                print(f"  ✓ Generated with ffmpeg: {out_file}")

if __name__ == "__main__":
    asyncio.run(main())
