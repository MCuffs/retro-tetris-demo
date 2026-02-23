import sys
from PIL import Image

def make_transparent(input_path, output_path):
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()

        newData = []
        for item in datas:
            # Change all white (also shades of whites)
            # to transparent
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Success: {input_path} -> {output_path}")
    except Exception as e:
        print(f"Error ({input_path}): {e}")

if __name__ == "__main__":
    make_transparent("assets/hero_chibi.png", "assets/hero_chibi.png")
    make_transparent("assets/monster_slime.png", "assets/monster_slime.png")
