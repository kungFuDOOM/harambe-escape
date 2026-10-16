# Mean luminance of the walk band (hero columns excluded) in 844x390 screenshots of each AI-plate screen: python3 qa-floor-contrast.py <dir> [<dir>...]
import sys, numpy as np
from PIL import Image
lane = {1: (124, 172), 2: (116, 166), 3: (122, 174), 4: (118, 176), 5: (130, 176)}
feat = {1: [3, 5], 2: [3, 5], 3: [5, 6], 4: [5], 5: [5, 7]}
for d in sys.argv[1:]:
    print(d)
    for s, fl in feat.items():
        nm = ['zoo', 'street', 'office', 'base', 'jungle'][s - 1]
        for i in fl:
            a = np.array(Image.open(f'{d}/{nm}_{i:02d}.png').convert('RGB')).astype(float); y0, y1 = int(lane[s][0] * 390 / 180), int(lane[s][1] * 390 / 180)
            px = np.concatenate([a[y0:y1, 80:380].reshape(-1, 3), a[y0:y1, 640:760].reshape(-1, 3)])
            print('  ', nm, i, round(float((px @ [0.2126, 0.7152, 0.0722]).mean()), 1))
