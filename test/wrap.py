from pathlib import Path

body = Path('src/page.html').read_text(encoding='utf-8')
Path('src/index.html').write_text('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'+body.split('<canvas',1)[0]+'</head>\n<body>\n<canvas'+body.split('<canvas',1)[1]+'\n</body>\n</html>\n', encoding='utf-8', newline='\n')
