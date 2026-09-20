from PIL import Image
im = Image.open('/home/ubuntu/eduflow-frontend/icon.png').convert('RGB')
for xy in [(700,100),(700,250),(700,350),(100,100),(10,10),(500,250),(250,350),(400,450)]:
    print(xy, im.getpixel(xy))
