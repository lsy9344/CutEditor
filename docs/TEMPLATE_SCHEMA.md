# Template JSON Schema (요약)

- 필수 키: id, name, canvas{width_mm,height_mm,dpi,bleed_mm,safe_mm,background}, overlay, slots[], texts[]

예시(4컷-가로):
{
  "id": "4-hor",
  "name": "4컷-가로",
  "canvas": {"width_mm":150,"height_mm":100,"dpi":600,"bleed_mm":1.5,"safe_mm":2.0,"background":"#ffffff"},
  "overlay": "/overlays/4_horizontal.png",
  "slots": [
    {"id":"s1","x_mm":5,"y_mm":5,"w_mm":32,"h_mm":42,"rotation":0,"mode":"cover"},
    {"id":"s2","x_mm":41,"y_mm":5,"w_mm":32,"h_mm":42,"rotation":0,"mode":"cover"},
    {"id":"s3","x_mm":77,"y_mm":5,"w_mm":32,"h_mm":42,"rotation":0,"mode":"cover"},
    {"id":"s4","x_mm":113,"y_mm":5,"w_mm":32,"h_mm":42,"rotation":0,"mode":"cover"}
  ],
  "texts": [
    {"id":"t1","x_mm":75,"y_mm":95,"w_mm":60,"h_mm":10,"align":"center",
     "style":{"font":"Noto Sans KR","size_pt":12,"italic_deg":12,"letter":0,"line":1},
     "value":""}
  ]
}

## 변환식
px = mm / 25.4 * dpi