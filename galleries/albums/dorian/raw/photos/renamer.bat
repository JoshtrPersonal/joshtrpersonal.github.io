setlocal enabledelayedexpansion
set i=1
for %%f in (*.jpg) do (
  set num=0000!i!
  ren "%%f" "IMG_!num:~-4!.jpg"
  set /a i+=1
)