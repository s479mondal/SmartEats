import matplotlib.pyplot as plt
import matplotlib.patches as patches
import textwrap
import os

out_dir = os.path.abspath('diagrams')
os.makedirs(out_dir, exist_ok=True)

plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['axes.edgecolor'] = 'none'

# ==========================================
# DIAGRAM 1: Problem Statement Master Diagram
# ==========================================
fig, ax = plt.subplots(figsize=(14, 8), dpi=300)
ax.set_facecolor('#0B132B')
fig.patch.set_facecolor('#0B132B')

plt.suptitle("CONVENTIONAL FOOD DELIVERY PLATFORMS: CORE OPERATIONAL PAIN POINTS", 
             fontsize=15, fontweight='bold', color='#FFFFFF', y=0.96)
plt.title("Root Causes, Systemic Flaws, and Operational Consequences in Current Architecture", 
          fontsize=11, color='#94A3B8', pad=10)

quadrants = [
    {
        "title": "1. DEMAND UNCERTAINTY",
        "color": "#EF4444",
        "bg": "#161B33",
        "pos": (0.03, 0.51, 0.45, 0.38),
        "cause": "Cause: Absence of spatio-temporal demand forecasting models.",
        "flaw": "Flaw: Restaurants prepare food blindly based on intuition.",
        "impact": "Impact: Food waste during off-peak hours & kitchen stock-outs during order surges."
    },
    {
        "title": "2. NAIVE DELIVERY ALLOCATION",
        "color": "#F59E0B",
        "bg": "#161B33",
        "pos": (0.52, 0.51, 0.45, 0.38),
        "cause": "Cause: Static nearest-neighbor Euclidean distance heuristics.",
        "flaw": "Flaw: Ignores kitchen prep status, active driver load, & traffic.",
        "impact": "Impact: Excessive driver idle time, late pickups, & higher fuel consumption."
    },
    {
        "title": "3. INACCURATE ETA CALCULATIONS",
        "color": "#3B82F6",
        "bg": "#161B33",
        "pos": (0.03, 0.07, 0.45, 0.38),
        "cause": "Cause: Simple distance-divided-by-speed formulas.",
        "flaw": "Flaw: Omits multi-stop delays, prep queues, & driver workload.",
        "impact": "Impact: Frequent missed Delivery SLAs, customer anxiety, & uncoordinated order readiness."
    },
    {
        "title": "4. UNMANAGED FOOD SURPLUS & WASTE",
        "color": "#10B981",
        "bg": "#161B33",
        "pos": (0.52, 0.07, 0.45, 0.38),
        "cause": "Cause: Complete lack of automated surplus recovery channels.",
        "flaw": "Flaw: Prepared canceled or over-prepared meals are thrown away.",
        "impact": "Impact: Direct financial loss for restaurants & massive environmental carbon footprint."
    }
]

for q in quadrants:
    x, y, w, h = q["pos"]
    rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.01,rounding_size=0.03",
                                 facecolor=q["bg"], edgecolor=q["color"], linewidth=2)
    ax.add_patch(rect)
    
    badge = patches.FancyBboxPatch((x + 0.02, y + h - 0.08), w - 0.04, 0.06, 
                                   boxstyle="round,pad=0.01,rounding_size=0.02",
                                   facecolor=q["color"], edgecolor='none')
    ax.add_patch(badge)
    ax.text(x + 0.04, y + h - 0.05, q['title'], fontsize=11, fontweight='bold', color='#FFFFFF', va='center')
    
    cause_lines = textwrap.wrap(q["cause"], width=42)
    flaw_lines = textwrap.wrap(q["flaw"], width=42)
    impact_lines = textwrap.wrap(q["impact"], width=44)
    
    cur_y = y + h - 0.12
    for line in cause_lines:
        ax.text(x + 0.03, cur_y, line, fontsize=9.5, fontweight='bold', color='#E2E8F0', va='top')
        cur_y -= 0.035
    
    cur_y -= 0.01
    for line in flaw_lines:
        ax.text(x + 0.03, cur_y, line, fontsize=9.5, color='#CBD5E1', va='top')
        cur_y -= 0.035

    cur_y -= 0.01
    for line in impact_lines:
        ax.text(x + 0.03, cur_y, line, fontsize=9, color='#94A3B8', style='italic', va='top')
        cur_y -= 0.033

center_box = patches.FancyBboxPatch((0.43, 0.44), 0.14, 0.08, boxstyle="round,pad=0.01,rounding_size=0.02",
                                    facecolor='#DC2626', edgecolor='#FFFFFF', linewidth=2)
ax.add_patch(center_box)
ax.text(0.50, 0.48, "CORE SYSTEMIC\nDISCONNECT", fontsize=9, fontweight='bold', color='#FFFFFF', ha='center', va='center')

ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis('off')
plt.tight_layout()
diag1_path = os.path.join(out_dir, "problem_statement_diagram.png")
plt.savefig(diag1_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.close()

# ==========================================
# DIAGRAM 2: Conventional vs SmartEats Architecture
# ==========================================
fig, ax = plt.subplots(figsize=(14, 7.5), dpi=300)
ax.set_facecolor('#0F172A')
fig.patch.set_facecolor('#0F172A')

plt.suptitle("OPERATIONAL PIPELINE COMPARISON", fontsize=15, fontweight='bold', color='#FFFFFF', y=0.96)
plt.title("Fragmented Siloes (Traditional Platforms) vs. Unified Event-Driven Feedback Loop (SmartEats)", 
          fontsize=11, color='#94A3B8', pad=10)

rect_conv = patches.FancyBboxPatch((0.03, 0.52), 0.94, 0.39, boxstyle="round,pad=0.01,rounding_size=0.03",
                                    facecolor='#1E293B', edgecolor='#64748B', linewidth=1.5)
ax.add_patch(rect_conv)
ax.text(0.05, 0.86, "CONVENTIONAL PLATFORM (FRAGMENTED SILOES)", fontsize=11, fontweight='bold', color='#F87171')

conv_steps = [
    ("Demand Forecasting", "None or Standalone\n(Analytics vacuum)"),
    ("Kitchen Preparation", "Manual Intuition\n(Over/Under prep)"),
    ("Delivery Dispatch", "Nearest-Driver\n(Ignores prep & traffic)"),
    ("ETA Calculation", "Static Distance Math\n(Frequent SLA breach)"),
    ("Food Waste", "Disposed as Trash\n(Zero value recovery)")
]

for i, (title, desc) in enumerate(conv_steps):
    cx = 0.05 + i * 0.185
    cy = 0.56
    box = patches.FancyBboxPatch((cx, cy), 0.16, 0.24, boxstyle="round,pad=0.01,rounding_size=0.02",
                                 facecolor='#0F172A', edgecolor='#F87171', linewidth=1)
    ax.add_patch(box)
    ax.text(cx + 0.08, cy + 0.18, title, fontsize=9.5, fontweight='bold', color='#FFFFFF', ha='center', va='center')
    ax.text(cx + 0.08, cy + 0.08, desc, fontsize=8.5, color='#94A3B8', ha='center', va='center')
    
    if i < len(conv_steps) - 1:
        ax.annotate("", xy=(cx + 0.185, cy + 0.12), xytext=(cx + 0.16, cy + 0.12),
                    arrowprops=dict(arrowstyle="->", color="#EF4444", lw=2, linestyle='--'))

rect_smart = patches.FancyBboxPatch((0.03, 0.05), 0.94, 0.43, boxstyle="round,pad=0.01,rounding_size=0.03",
                                     facecolor='#064E3B', edgecolor='#10B981', linewidth=2)
ax.add_patch(rect_smart)
ax.text(0.05, 0.43, "SMARTEATS INTEGRATED PIPELINE (EVENT-DRIVEN AI FEEDBACK LOOP)", fontsize=11, fontweight='bold', color='#34D399')

smart_steps = [
    ("ML Demand Forecast", "XGBoost / LSTM\nSpatial-Temporal Model"),
    ("Dynamic Prep Recs", "Forecast-Driven\nBatch Kitchen Guidance"),
    ("Multi-Factor Dispatch", "Prep Time + Traffic +\nDriver Load Optimization"),
    ("Real-Time ETA", "ML Ensemble Model +\nLive RabbitMQ Telemetry"),
    ("Smart Food Rescue", "Dynamic Discount (up to 70%)\nProximity Match & Alerts")
]

for i, (title, desc) in enumerate(smart_steps):
    cx = 0.05 + i * 0.185
    cy = 0.09
    box = patches.FancyBboxPatch((cx, cy), 0.16, 0.27, boxstyle="round,pad=0.01,rounding_size=0.02",
                                 facecolor='#065F46', edgecolor='#6EE7B7', linewidth=1.5)
    ax.add_patch(box)
    ax.text(cx + 0.08, cy + 0.20, title, fontsize=9.5, fontweight='bold', color='#FFFFFF', ha='center', va='center')
    ax.text(cx + 0.08, cy + 0.09, desc, fontsize=8.5, color='#D1D5DB', ha='center', va='center')
    
    if i < len(smart_steps) - 1:
        ax.annotate("", xy=(cx + 0.185, cy + 0.135), xytext=(cx + 0.16, cy + 0.135),
                    arrowprops=dict(arrowstyle="->", color="#34D399", lw=2.5))

ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis('off')
plt.tight_layout()
diag2_path = os.path.join(out_dir, "conventional_vs_smarteats.png")
plt.savefig(diag2_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.close()

# ==========================================
# DIAGRAM 3: 5-Dimensional Research & System Gap Matrix
# ==========================================
fig, ax = plt.subplots(figsize=(14, 7.5), dpi=300)
ax.set_facecolor('#0D1117')
fig.patch.set_facecolor('#0D1117')

plt.suptitle("RESEARCH & SYSTEM GAP: FIVE DIMENSIONAL MATRIX", fontsize=15, fontweight='bold', color='#FFFFFF', y=0.96)
plt.title("Bridging Literature Isolation to Build an Integrated Intelligent Food-Delivery System", 
          fontsize=11, color='#8B949E', pad=10)

gaps = [
    {
        "dim": "DIMENSION 1",
        "title": "INTEGRATION GAP",
        "desc": "Existing literature studies forecasting, ETA, optimization, & waste separately. SmartEats unifies all four into a single pipeline.",
        "color": "#38BDF8",
        "pos": (0.03, 0.50, 0.29, 0.40)
    },
    {
        "dim": "DIMENSION 2",
        "title": "PREDICTION-TO-DECISION",
        "desc": "Prior forecasting stops at prediction. SmartEats translates demand forecasts directly into active kitchen prep recommendations.",
        "color": "#F43F5E",
        "pos": (0.35, 0.50, 0.29, 0.40)
    },
    {
        "dim": "DIMENSION 3",
        "title": "DYNAMIC OPTIMIZATION",
        "desc": "Moves beyond simple nearest-neighbor dispatch to multi-objective optimization considering prep times, driver load, & SLA delays.",
        "color": "#F59E0B",
        "pos": (0.67, 0.50, 0.29, 0.40)
    },
    {
        "dim": "DIMENSION 4",
        "title": "SUSTAINABILITY INTEGRATION",
        "desc": "Food waste reduction is traditionally treated as an offline non-profit initiative. SmartEats embeds Smart Food Rescue into platform UX.",
        "color": "#10B981",
        "pos": (0.19, 0.05, 0.29, 0.40)
    },
    {
        "dim": "DIMENSION 5",
        "title": "DISTRIBUTED ARCHITECTURE",
        "desc": "Demonstrates decoupled event-driven microservices (Spring Boot + RabbitMQ) to process live order & delivery telemetry asynchronously.",
        "color": "#A855F7",
        "pos": (0.51, 0.05, 0.29, 0.40)
    }
]

for g in gaps:
    x, y, w, h = g["pos"]
    box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.01,rounding_size=0.03",
                                 facecolor='#161B22', edgecolor=g["color"], linewidth=2)
    ax.add_patch(box)
    
    ax.text(x + 0.03, y + h - 0.04, g["dim"], fontsize=8.5, fontweight='bold', color=g["color"], va='top')
    ax.text(x + 0.03, y + h - 0.09, g["title"], fontsize=10.5, fontweight='bold', color='#FFFFFF', va='top')
    ax.plot([x + 0.03, x + w - 0.03], [y + h - 0.14, y + h - 0.14], color=g["color"], lw=1, alpha=0.5)
    
    lines = textwrap.wrap(g["desc"], width=32)
    cur_y = y + h - 0.17
    for line in lines:
        ax.text(x + 0.03, cur_y, line, fontsize=8.5, color='#C9D1D9', va='top')
        cur_y -= 0.038

ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis('off')
plt.tight_layout()
diag3_path = os.path.join(out_dir, "research_gap_matrix.png")
plt.savefig(diag3_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.close()

# ==========================================
# DIAGRAM 5: Smart Food Rescue Workflow
# ==========================================
fig, ax = plt.subplots(figsize=(14, 7.5), dpi=300)
ax.set_facecolor('#061A14')
fig.patch.set_facecolor('#061A14')

plt.suptitle("SMART FOOD RESCUE & SURPLUS RECOVERY WORKFLOW", fontsize=15, fontweight='bold', color='#FFFFFF', y=0.96)
plt.title("Converting Potential Kitchen Waste into Value-Added Rescue Offers via Proximity & Preference Matching", 
          fontsize=11, color='#A7F3D0', pad=10)

rescue_steps = [
    {
        "step": "STEP 1",
        "title": "SURPLUS DETECTED",
        "desc": "Forecast mismatch or canceled prepared order logs item into rescue queue.",
        "color": "#EF4444",
        "x": 0.04
    },
    {
        "step": "STEP 2",
        "title": "SAFETY & EXPIRY",
        "desc": "System verifies shelf-life, hygiene window, & packaging integrity.",
        "color": "#F59E0B",
        "x": 0.23
    },
    {
        "step": "STEP 3",
        "title": "DYNAMIC PRICING",
        "desc": "Algorithmic pricing scales discount (30% to 70% off) based on time remaining.",
        "color": "#3B82F6",
        "x": 0.42
    },
    {
        "step": "STEP 4",
        "title": "GEO & PREFERENCE",
        "desc": "Matches nearby active users (< 3km) based on food category preferences.",
        "color": "#8B5CF6",
        "x": 0.61
    },
    {
        "step": "STEP 5",
        "title": "RESCUE & IMPACT",
        "desc": "Customer purchases rescue deal; food waste saved; CO2 offset logged.",
        "color": "#10B981",
        "x": 0.80
    }
]

for s in rescue_steps:
    x = s["x"]
    box = patches.FancyBboxPatch((x, 0.15), 0.16, 0.65, boxstyle="round,pad=0.01,rounding_size=0.03",
                                 facecolor='#064E3B', edgecolor=s["color"], linewidth=2)
    ax.add_patch(box)
    
    ax.text(x + 0.08, 0.73, s["step"], fontsize=8.5, fontweight='bold', color=s["color"], ha='center', va='center')
    ax.text(x + 0.08, 0.65, s["title"], fontsize=9.5, fontweight='bold', color='#FFFFFF', ha='center', va='center')
    ax.plot([x + 0.02, x + 0.14], [0.58, 0.58], color=s["color"], lw=1)
    
    lines = textwrap.wrap(s["desc"], width=16)
    cur_y = 0.50
    for line in lines:
        ax.text(x + 0.08, cur_y, line, fontsize=8.5, color='#D1D5DB', ha='center', va='top')
        cur_y -= 0.045
    
    if s["x"] < 0.80:
        ax.annotate("", xy=(x + 0.19, 0.475), xytext=(x + 0.16, 0.475),
                    arrowprops=dict(arrowstyle="->", color="#34D399", lw=2.5))

ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis('off')
plt.tight_layout()
diag5_path = os.path.join(out_dir, "smart_food_rescue_pipeline.png")
plt.savefig(diag5_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.close()

print("Regenerated diagram images cleanly!")
