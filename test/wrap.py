import sys
body=open('src/page.html').read()
open('src/index.html','w').write('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'+body.split('<canvas',1)[0]+'</head>\n<body>\n<canvas'+body.split('<canvas',1)[1]+'\n</body>\n</html>\n')
