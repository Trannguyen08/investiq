"""Generate professional SVG avatars for 22 prominent Vietnamese business leaders."""

import os
from pathlib import Path

LEADERS = [
    {
        "id": "person-1",
        "name": "Phạm Nhật Vượng",
        "initials": "PV",
        "title": "Vingroup",
        "gender": "male",
        "c1": "#1e3c72",
        "c2": "#2a5298",
        "accent": "#ffd700",
        "glow": "rgba(255, 215, 0, 0.4)",
    },
    {
        "id": "person-2",
        "name": "Trần Đình Long",
        "initials": "TL",
        "title": "Hòa Phát",
        "gender": "male",
        "c1": "#1f4037",
        "c2": "#99f2c8",
        "accent": "#48dbfb",
        "glow": "rgba(72, 219, 251, 0.4)",
    },
    {
        "id": "person-3",
        "name": "Nguyễn Thị Phương Thảo",
        "initials": "NT",
        "title": "Vietjet · HDBank",
        "gender": "female",
        "c1": "#ba1327",
        "c2": "#f85032",
        "accent": "#feca57",
        "glow": "rgba(254, 202, 87, 0.4)",
    },
    {
        "id": "person-4",
        "name": "Đỗ Anh Tuấn",
        "initials": "AT",
        "title": "Sunshine Group",
        "gender": "male",
        "c1": "#3a1c71",
        "c2": "#d76d77",
        "accent": "#ffaf7b",
        "glow": "rgba(255, 175, 123, 0.4)",
    },
    {
        "id": "person-5",
        "name": "Hồ Hùng Anh",
        "initials": "HA",
        "title": "Techcombank",
        "gender": "male",
        "c1": "#c0392b",
        "c2": "#8e44ad",
        "accent": "#00d2d3",
        "glow": "rgba(0, 210, 211, 0.4)",
    },
    {
        "id": "person-6",
        "name": "Nguyễn Đăng Quang",
        "initials": "NQ",
        "title": "Masan Group",
        "gender": "male",
        "c1": "#e65c00",
        "c2": "#f9d423",
        "accent": "#ff9f43",
        "glow": "rgba(255, 159, 67, 0.4)",
    },
    {
        "id": "person-7",
        "name": "Trương Gia Bình",
        "initials": "TB",
        "title": "FPT Group",
        "gender": "male",
        "c1": "#0052d4",
        "c2": "#4364f7",
        "accent": "#6fb1fc",
        "glow": "rgba(111, 177, 252, 0.4)",
    },
    {
        "id": "person-8",
        "name": "Bùi Thành Nhơn",
        "initials": "BN",
        "title": "Novaland",
        "gender": "male",
        "c1": "#0ba360",
        "c2": "#3cba92",
        "accent": "#1dd1a1",
        "glow": "rgba(29, 209, 161, 0.4)",
    },
    {
        "id": "person-9",
        "name": "Nguyễn Đức Tài",
        "initials": "NT",
        "title": "Thế Giới Di Động",
        "gender": "male",
        "c1": "#f39c12",
        "c2": "#d35400",
        "accent": "#f1c40f",
        "glow": "rgba(241, 196, 15, 0.4)",
    },
    {
        "id": "person-10",
        "name": "Đặng Thành Tâm",
        "initials": "TT",
        "title": "Đô thị Kinh Bắc",
        "gender": "male",
        "c1": "#134e5e",
        "c2": "#71b280",
        "accent": "#55efc4",
        "glow": "rgba(85, 239, 196, 0.4)",
    },
    {
        "id": "person-11",
        "name": "Nguyễn Văn Đạt",
        "initials": "NĐ",
        "title": "Bất động sản Phát Đạt",
        "gender": "male",
        "c1": "#870000",
        "c2": "#190a05",
        "accent": "#ff7675",
        "glow": "rgba(255, 118, 117, 0.4)",
    },
    {
        "id": "person-12",
        "name": "Đoàn Nguyên Đức",
        "initials": "NĐ",
        "title": "Hoàng Anh Gia Lai",
        "gender": "male",
        "c1": "#11998e",
        "c2": "#38ef7d",
        "accent": "#ffeaa7",
        "glow": "rgba(255, 234, 167, 0.4)",
    },
    {
        "id": "person-13",
        "name": "Hồ Xuân Năng",
        "initials": "XN",
        "title": "Vicostone · Phenikaa",
        "gender": "male",
        "c1": "#4b134f",
        "c2": "#c94b4b",
        "accent": "#a29bfe",
        "glow": "rgba(162, 155, 254, 0.4)",
    },
    {
        "id": "person-14",
        "name": "Nguyễn Duy Hưng",
        "initials": "DH",
        "title": "Chứng khoán SSI",
        "gender": "male",
        "c1": "#141e30",
        "c2": "#243b55",
        "accent": "#00cec9",
        "glow": "rgba(0, 206, 201, 0.4)",
    },
    {
        "id": "person-15",
        "name": "Đặng Văn Thành",
        "initials": "VT",
        "title": "Tập đoàn TTC",
        "gender": "male",
        "c1": "#1d976c",
        "c2": "#93f9b9",
        "accent": "#fab1a0",
        "glow": "rgba(250, 177, 160, 0.4)",
    },
    {
        "id": "person-16",
        "name": "Nguyễn Thị Mai Thanh",
        "initials": "MT",
        "title": "Cơ Điện Lạnh REE",
        "gender": "female",
        "c1": "#005c97",
        "c2": "#363795",
        "accent": "#81ecec",
        "glow": "rgba(129, 236, 236, 0.4)",
    },
    {
        "id": "person-17",
        "name": "Lê Viết Hải",
        "initials": "VH",
        "title": "Xây dựng Hòa Bình",
        "gender": "male",
        "c1": "#2c3e50",
        "c2": "#3498db",
        "accent": "#74b9ff",
        "glow": "rgba(116, 185, 255, 0.4)",
    },
    {
        "id": "person-18",
        "name": "Johnathan Hạnh Nguyễn",
        "initials": "HN",
        "title": "Tập đoàn IPPG",
        "gender": "male",
        "c1": "#42275a",
        "c2": "#734b6d",
        "accent": "#ffd700",
        "glow": "rgba(255, 215, 0, 0.4)",
    },
    {
        "id": "person-19",
        "name": "Trương Anh Tuấn",
        "initials": "AT",
        "title": "Địa ốc Hoàng Quân",
        "gender": "male",
        "c1": "#d35400",
        "c2": "#c0392b",
        "accent": "#ffeaa7",
        "glow": "rgba(255, 234, 167, 0.4)",
    },
    {
        "id": "person-20",
        "name": "Đào Hồng Tuyển",
        "initials": "HT",
        "title": "Tập đoàn Tuần Châu",
        "gender": "male",
        "c1": "#0083b0",
        "c2": "#00b4db",
        "accent": "#55efc4",
        "glow": "rgba(85, 239, 196, 0.4)",
    },
    {
        "id": "person-21",
        "name": "Nguyễn Cảnh Sơn",
        "initials": "CS",
        "title": "Eurowindow Holding",
        "gender": "male",
        "c1": "#283048",
        "c2": "#859398",
        "accent": "#0984e3",
        "glow": "rgba(9, 132, 227, 0.4)",
    },
    {
        "id": "person-22",
        "name": "Huỳnh Uy Dũng",
        "initials": "UD",
        "title": "Tập đoàn Đại Nam",
        "gender": "male",
        "c1": "#8a2387",
        "c2": "#e94057",
        "accent": "#f27121",
        "glow": "rgba(242, 113, 33, 0.4)",
    },
]


def generate_svg(leader: dict) -> str:
    grad_id = f"g_{leader['id']}"
    initials = leader["initials"]
    accent = leader["accent"]
    glow = leader["glow"]
    c1 = leader["c1"]
    c2 = leader["c2"]
    is_female = leader["gender"] == "female"

    # Silhouette paths for male vs female business portrait
    if is_female:
        # Elegant portrait silhouette with scarf/neckline & refined hairstyle
        silhouette = f"""
      <!-- Head / Hair -->
      <ellipse cx="60" cy="46" rx="17" ry="20" fill="url(#{grad_id})" opacity="0.95" />
      <path d="M43 46 C41 33 49 22 60 22 C71 22 79 33 77 46 C77 56 73 63 60 63 C47 63 43 56 43 46 Z" fill="#ffffff" opacity="0.9" />
      <path d="M41 42 C40 32 46 20 60 20 C74 20 80 32 79 42 C79 50 76 56 73 60 C78 52 77 34 68 28 C61 24 53 26 49 32 C46 36 43 45 44 58 C42 53 41 47 41 42 Z" fill="{accent}" opacity="0.6" />
      
      <!-- Neck & Collar / Dress -->
      <path d="M54 62 L66 62 L69 72 L51 72 Z" fill="#ffffff" opacity="0.85" />
      <path d="M30 106 C30 84 42 74 53 73 L60 84 L67 73 C78 74 90 84 90 106 Z" fill="#ffffff" opacity="0.92" />
      <path d="M53 73 L60 84 L67 73 L60 76 Z" fill="{accent}" />
      <circle cx="60" cy="80" r="2.5" fill="#ffffff" />
        """
    else:
        # Distinguished executive silhouette with suit jacket, collared shirt & tie
        silhouette = f"""
      <!-- Head -->
      <ellipse cx="60" cy="44" rx="16" ry="19" fill="#ffffff" opacity="0.92" />
      <!-- Hair accent -->
      <path d="M44 41 C44 28 50 22 60 22 C70 22 76 28 76 41 C76 34 72 26 60 26 C48 26 44 34 44 41 Z" fill="{accent}" opacity="0.75" />
      
      <!-- Collar & Neck -->
      <path d="M54 60 L66 60 L68 70 L52 70 Z" fill="#ffffff" opacity="0.85" />
      <!-- Suit Shoulders -->
      <path d="M28 106 C28 85 40 73 52 71 L60 88 L68 71 C80 73 92 85 92 106 Z" fill="#ffffff" opacity="0.92" />
      <!-- Tie -->
      <polygon points="58,72 62,72 64,88 60,94 56,88" fill="{accent}" />
      <!-- Lapel V-Cut -->
      <path d="M52 71 L60 88 L46 106 M68 71 L60 88 L74 106" stroke="{c1}" stroke-width="2.2" stroke-linecap="round" fill="none" />
        """

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="{grad_id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c1}" />
      <stop offset="100%" stop-color="{c2}" />
    </linearGradient>

    <!-- Metallic Gold/Accent Gradient -->
    <linearGradient id="acc_{leader['id']}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="50%" stop-color="{accent}" />
      <stop offset="100%" stop-color="{c1}" />
    </linearGradient>

    <!-- Outer Glow Filter -->
    <filter id="glow_{leader['id']}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Inner Mask for Silhouette clipping -->
    <clipPath id="circle_clip_{leader['id']}">
      <circle cx="60" cy="60" r="54" />
    </clipPath>
  </defs>

  <!-- Outer Ambient Glow Ring -->
  <circle cx="60" cy="60" r="57" fill="none" stroke="{accent}" stroke-width="1.5" opacity="0.35" />

  <!-- Base Circle with Gradient -->
  <circle cx="60" cy="60" r="55" fill="url(#{grad_id})" />

  <!-- Subtle Architectural Geo Lines in BG -->
  <g opacity="0.12" stroke="#ffffff" stroke-width="0.8">
    <circle cx="60" cy="60" r="42" fill="none" />
    <circle cx="60" cy="60" r="28" fill="none" />
    <line x1="20" y1="20" x2="100" y2="100" />
    <line x1="20" y1="100" x2="100" y2="20" />
  </g>

  <!-- Clipped Silhouette -->
  <g clip-path="url(#circle_clip_{leader['id']})">
    {silhouette}
  </g>

  <!-- Polished Double Outer Border -->
  <circle cx="60" cy="60" r="55" fill="none" stroke="url(#acc_{leader['id']})" stroke-width="2.5" />
  <circle cx="60" cy="60" r="52.5" fill="none" stroke="#ffffff" stroke-width="0.75" opacity="0.4" />

  <!-- Monogram Pill at bottom right -->
  <g transform="translate(76, 76)">
    <circle cx="16" cy="16" r="15" fill="#071726" stroke="{accent}" stroke-width="1.8" filter="url(#glow_{leader['id']})" />
    <circle cx="16" cy="16" r="13" fill="url(#{grad_id})" opacity="0.85" />
    <text x="16" y="20.5" 
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="10.5" 
          font-weight="900" 
          fill="#ffffff" 
          text-anchor="middle" 
          letter-spacing="0.5">{initials}</text>
  </g>
</svg>
"""
    return svg


import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")


def main():
    target_dir = Path("frontend/public/images/leaders")
    target_dir.mkdir(parents=True, exist_ok=True)
    print(f"Generating 22 leader SVG avatars in {target_dir}...")

    for leader in LEADERS:
        svg_content = generate_svg(leader)
        file_path = target_dir / f"{leader['id']}.svg"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(svg_content)
        print(f"Generated {file_path.name}")

    print("Successfully generated all 22 leader avatars!")


if __name__ == "__main__":
    main()
