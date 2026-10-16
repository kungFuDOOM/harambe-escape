"""Builds only what is still procedural: the pixel font and the props atlas (crates, bananas, sparks, kid).
Characters and backgrounds are AI-generated art sliced by tools/ai-art/."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import font, props
OUT = props.OUTD
font.build(os.path.join(OUT, 'font.png'))
props.prop_sheet()
print('props + font built')
