import pptx
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
import os

prs_path = 'SmartEats_Presentation [Autosaved].pptx'
prs = pptx.Presentation(prs_path)

# Set slide width and height to 16:9 widescreen if needed, or inspect current size
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

print(f"Slide dimensions: {prs.slide_width.inches} x {prs.slide_height.inches} inches")

# Color Palette
NAVY_HEADER = RGBColor(13, 35, 58)      # #0D233A
ROYAL_BLUE = RGBColor(30, 58, 138)     # #1E3A8A
ACCENT_GREEN = RGBColor(16, 185, 129)   # #10B981
ACCENT_CORAL = RGBColor(239, 68, 68)    # #EF4444
DARK_BG = RGBColor(15, 23, 42)         # #0F172A
TEXT_DARK = RGBColor(30, 41, 59)        # #1E293B
TEXT_MUTED = RGBColor(100, 116, 139)   # #64748B
CARD_BG = RGBColor(241, 245, 249)      # #F1F5F9
WHITE = RGBColor(255, 255, 255)

def add_header_footer(slide, title_text, category_text="SmartEats Capstone Dissertation-I"):
    # Header background bar
    hdr = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(1.1))
    hdr.fill.solid()
    hdr.fill.fore_color.rgb = NAVY_HEADER
    hdr.line.color.rgb = NAVY_HEADER

    # Header title
    tf = hdr.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title_text
    p.font.size = Pt(22)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.LEFT
    
    # Subheader category badge
    badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.2), Inches(0.25), Inches(2.8), Inches(0.5))
    badge.fill.solid()
    badge.fill.fore_color.rgb = ROYAL_BLUE
    badge.line.color.rgb = WHITE
    tf_b = badge.text_frame
    p_b = tf_b.paragraphs[0]
    p_b.text = "VIT | MCA Dissertation"
    p_b.font.size = Pt(11)
    p_b.font.bold = True
    p_b.font.color.rgb = WHITE
    p_b.alignment = PP_ALIGN.CENTER

    # Footer bar
    ftr = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(7.0), Inches(13.333), Inches(0.5))
    ftr.fill.solid()
    ftr.fill.fore_color.rgb = NAVY_HEADER
    ftr.line.color.rgb = NAVY_HEADER
    
    tf_f = ftr.text_frame
    p_f = tf_f.paragraphs[0]
    p_f.text = "SmartEats: Intelligent Food Delivery with Demand Forecasting & Surplus Recovery | Reg No: 25MCA0195"
    p_f.font.size = Pt(10)
    p_f.font.color.rgb = WHITE
    p_f.alignment = PP_ALIGN.CENTER

def clear_slide(slide):
    # Remove all shapes except keep nothing so we rebuild cleanly
    shapes = list(slide.shapes)
    for s in shapes:
        sp = s._element
        sp.getparent().remove(sp)

# Diagram file paths
diag_dir = os.path.abspath('diagrams')
diag1 = os.path.join(diag_dir, 'problem_statement_diagram.png')
diag2 = os.path.join(diag_dir, 'conventional_vs_smarteats.png')
diag3 = os.path.join(diag_dir, 'research_gap_matrix.png')
diag4 = os.path.join(diag_dir, 'system_architecture.png')
diag5 = os.path.join(diag_dir, 'smart_food_rescue_pipeline.png')

# -------------------------------------------------------------
# SLIDE 1: Title Slide
# -------------------------------------------------------------
s1 = prs.slides[0]
clear_slide(s1)

bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
bg1.fill.solid()
bg1.fill.fore_color.rgb = NAVY_HEADER
bg1.line.color.rgb = NAVY_HEADER

# Title box
tb1 = s1.shapes.add_textbox(Inches(1.0), Inches(1.2), Inches(11.333), Inches(2.2))
tf1 = tb1.text_frame
tf1.word_wrap = True

p = tf1.paragraphs[0]
p.text = "SmartEats"
p.font.size = Pt(36)
p.font.bold = True
p.font.color.rgb = ACCENT_GREEN

p2 = tf1.add_paragraph()
p2.text = "Intelligent Food Delivery Platform with Demand Forecasting & Food Rescue"
p2.font.size = Pt(24)
p2.font.bold = True
p2.font.color.rgb = WHITE

p3 = tf1.add_paragraph()
p3.text = "PMCA698J – Dissertation-I / Internship-1  |  Review-1 Presentation  |  14.08.2026"
p3.font.size = Pt(14)
p3.font.color.rgb = RGBColor(148, 163, 184)

# Info Cards
c1 = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(3.8), Inches(5.4), Inches(2.8))
c1.fill.solid()
c1.fill.fore_color.rgb = RGBColor(30, 41, 59)
c1.line.color.rgb = ROYAL_BLUE
tf_c1 = c1.text_frame
tf_c1.word_wrap = True
p = tf_c1.paragraphs[0]
p.text = "STUDENT DETAILS"
p.font.size = Pt(14)
p.font.bold = True
p.font.color.rgb = ACCENT_GREEN

p = tf_c1.add_paragraph()
p.text = "Name: Soumen Mondal\nRegistration No.: 25MCA0195\nDegree: Master of Computer Applications (M.C.A)\nSchool: SCOPE, Vellore Institute of Technology"
p.font.size = Pt(12)
p.font.color.rgb = WHITE

c2 = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(3.8), Inches(5.4), Inches(2.8))
c2.fill.solid()
c2.fill.fore_color.rgb = RGBColor(30, 41, 59)
c2.line.color.rgb = ROYAL_BLUE
tf_c2 = c2.text_frame
tf_c2.word_wrap = True
p = tf_c2.paragraphs[0]
p.text = "PROJECT GUIDANCE"
p.font.size = Pt(14)
p.font.bold = True
p.font.color.rgb = ACCENT_GREEN

p = tf_c2.add_paragraph()
p.text = "Project Guide: Dr. Sentil Murugan B\nDepartment: School of Computer Science Engineering and Information Systems (SCOPE)\nInstitution: Vellore Institute of Technology (VIT), Vellore"
p.font.size = Pt(12)
p.font.color.rgb = WHITE


# -------------------------------------------------------------
# SLIDE 4: Problem Definition – Core Operational Pain Points (DIAGRAM 1)
# -------------------------------------------------------------
s4 = prs.slides[3]
clear_slide(s4)
add_header_footer(s4, "Problem Definition – Core Operational Pain Points")
s4.shapes.add_picture(diag1, Inches(0.5), Inches(1.3), Inches(12.333), Inches(5.4))

# -------------------------------------------------------------
# SLIDE 5: Problem Definition – Conventional Siloes vs SmartEats (DIAGRAM 2)
# -------------------------------------------------------------
s5 = prs.slides[4]
clear_slide(s5)
add_header_footer(s5, "Problem Definition – Conventional Siloes vs. Integrated Solution")
s5.shapes.add_picture(diag2, Inches(0.5), Inches(1.3), Inches(12.333), Inches(5.4))

# -------------------------------------------------------------
# SLIDE 10: Research Gap – Five Dimensional Matrix (DIAGRAM 3)
# -------------------------------------------------------------
s10 = prs.slides[9]
clear_slide(s10)
add_header_footer(s10, "Research & System Gap – Five Dimensional Analysis")
s10.shapes.add_picture(diag3, Inches(0.5), Inches(1.3), Inches(12.333), Inches(5.4))

# -------------------------------------------------------------
# SLIDE 16: System Architecture & Event-Driven Microservices (DIAGRAM 4)
# -------------------------------------------------------------
s16 = prs.slides[15]
clear_slide(s16)
add_header_footer(s16, "System Architecture – Event-Driven Microservices")
s16.shapes.add_picture(diag4, Inches(0.5), Inches(1.3), Inches(12.333), Inches(5.4))

# -------------------------------------------------------------
# SLIDE 17: AI/ML Architecture & Smart Food Rescue Workflow (DIAGRAM 5)
# -------------------------------------------------------------
s17 = prs.slides[16]
clear_slide(s17)
add_header_footer(s17, "AI/ML Pipelines & Smart Food Rescue Workflow")
s17.shapes.add_picture(diag5, Inches(0.5), Inches(1.3), Inches(12.333), Inches(5.4))


# Helper function to render formatted text card slides cleanly
def format_card_slide(slide, title, cards_data):
    clear_slide(slide)
    add_header_footer(slide, title)
    
    n = len(cards_data)
    if n == 2:
        coords = [(Inches(0.6), Inches(1.4), Inches(5.8), Inches(5.3)),
                  (Inches(6.8), Inches(1.4), Inches(5.8), Inches(5.3))]
    elif n == 3:
        coords = [(Inches(0.6), Inches(1.4), Inches(3.7), Inches(5.3)),
                  (Inches(4.8), Inches(1.4), Inches(3.7), Inches(5.3)),
                  (Inches(9.0), Inches(1.4), Inches(3.7), Inches(5.3))]
    elif n == 4:
        coords = [(Inches(0.6), Inches(1.4), Inches(5.8), Inches(2.5)),
                  (Inches(6.8), Inches(1.4), Inches(5.8), Inches(2.5)),
                  (Inches(0.6), Inches(4.2), Inches(5.8), Inches(2.5)),
                  (Inches(6.8), Inches(4.2), Inches(5.8), Inches(2.5))]
    else:
        coords = [(Inches(0.6), Inches(1.4), Inches(12.1), Inches(5.3))]

    for i, cdata in enumerate(cards_data):
        x, y, w, h = coords[i]
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ROYAL_BLUE
        card.line.width = Pt(1.5)

        tf = card.text_frame
        tf.word_wrap = True
        p0 = tf.paragraphs[0]
        p0.text = cdata["title"]
        p0.font.size = Pt(14)
        p0.font.bold = True
        p0.font.color.rgb = NAVY_HEADER

        for item in cdata["bullets"]:
            p = tf.add_paragraph()
            p.text = f"• {item}"
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_DARK
            p.space_before = Pt(4)

# -------------------------------------------------------------
# SLIDE 2: Abstract & Overview
# -------------------------------------------------------------
format_card_slide(prs.slides[1], "Abstract & Executive Overview", [
    {
        "title": "Core Operational Challenge",
        "bullets": [
            "Online food delivery has scaled dramatically, yet platforms operate reactively rather than predictively.",
            "Restaurants suffer from unpredictable demand variance leading to food wastage or stock-outs.",
            "Delivery dispatch uses naive nearest-neighbor distance formulas, ignoring kitchen preparation delays."
        ]
    },
    {
        "title": "SmartEats AI Solution",
        "bullets": [
            "Introduces an AI-driven, event-driven microservices architecture connecting all key platform stakeholders.",
            "Machine-Learning Demand Forecasting (XGBoost/LSTM) guides dynamic kitchen preparation recommendations.",
            "Multi-Factor Delivery Allocation & ETA Prediction optimizes driver routing and reduces order wait times.",
            "Smart Food Rescue pipeline automatically monetizes prepared surplus food via proximity discounts."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 3: Introduction & Motivation
# -------------------------------------------------------------
format_card_slide(prs.slides[2], "Introduction & Platform Motivation", [
    {
        "title": "Ecosystem Fragmentation",
        "bullets": [
            "Traditional platforms isolate customer ordering, restaurant preparation, and driver dispatch.",
            "Lack of shared real-time telemetry causes kitchen bottlenecks and inaccurate delivery estimates."
        ]
    },
    {
        "title": "SmartEats Integrated Vision",
        "bullets": [
            "Unified operational feedback loop where demand forecasts directly inform preparation planning.",
            "Real-time preparation state and driver availability feed directly into dynamic ETA calculation."
        ]
    },
    {
        "title": "Sustainability Goal",
        "bullets": [
            "Transforms food waste mitigation from an offline afterthought into an automated real-time transaction engine."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 6: Existing System & Limitations
# -------------------------------------------------------------
format_card_slide(prs.slides[5], "Existing Platform Architecture & Limitations", [
    {
        "title": "Conventional Platform Workflow",
        "bullets": [
            "Basic menu listing, order intake, and manual or rule-based driver dispatch.",
            "Static distance calculations without real-time kitchen preparation queue awareness."
        ]
    },
    {
        "title": "Systemic Limitations",
        "bullets": [
            "Forecasting Isolation: Standalone analytics that do not trigger operational prep guidance.",
            "Naive Nearest-Driver Dispatch: High driver idle time and poor SLA compliance during peak hours."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 7: Limitations of Existing Approaches
# -------------------------------------------------------------
format_card_slide(prs.slides[6], "Detailed Limitations of Current Approaches", [
    {
        "title": "ETA as a Separate Function",
        "bullets": [
            "Treated purely as customer display text rather than feeding into delivery allocation or route optimization."
        ]
    },
    {
        "title": "Disconnected Sustainability Solutions",
        "bullets": [
            "Food-waste reduction initiatives are evaluated completely separately from live delivery operations."
        ]
    },
    {
        "title": "Lack of End-to-End Coordination",
        "bullets": [
            "Individual intelligent components operate as independent silos without asynchronous event bus integration."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 8: Literature Survey Highlights
# -------------------------------------------------------------
format_card_slide(prs.slides[7], "Literature Survey & Technological Baseline", [
    {
        "title": "Demand Forecasting",
        "bullets": [
            "Spatio-temporal deep learning (LSTM, XGBoost, Poisson distribution) improves short-term volume prediction."
        ]
    },
    {
        "title": "Delivery & Route Optimization",
        "bullets": [
            "Deep reinforcement learning and vehicle routing heuristics enhance last-mile efficiency."
        ]
    },
    {
        "title": "ETA & Food Waste",
        "bullets": [
            "Regression ensembles outperform static formulas; data-driven models prove surplus predictability."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 9: Analysis of Literature & Research Gap
# -------------------------------------------------------------
format_card_slide(prs.slides[8], "Literature Analysis & Core Research Gap", [
    {
        "title": "Technological Readiness",
        "bullets": [
            "ML algorithms are proven to outperform naive baselines in forecasting and ETA prediction."
        ]
    },
    {
        "title": "Scalable Microservices",
        "bullets": [
            "Event-driven microservices architecture provides high scalability, resilience, and fault isolation."
        ]
    },
    {
        "title": "The Core Research Gap",
        "bullets": [
            "Forecasting research does not extend to resource planning; optimization omits demand forecasts; waste studies disconnect from live operations."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 11 & 12: Project Objectives
# -------------------------------------------------------------
format_card_slide(prs.slides[10], "Project Objectives (Part 1)", [
    {
        "title": "Core System Objectives",
        "bullets": [
            "Objective 1: Build a distributed online food-delivery platform connecting customers, restaurants, drivers, and admins.",
            "Objective 2: Develop an ML-based demand-forecasting module using historical and contextual spatio-temporal data.",
            "Objective 3: Implement an intelligent multi-factor delivery-allocation mechanism (distance, prep time, load, ETA).",
            "Objective 4: Build a real-time ETA-prediction model incorporating operational telemetry."
        ]
    }
])

format_card_slide(prs.slides[11], "Project Objectives (Part 2)", [
    {
        "title": "Intelligence & Sustainability Objectives",
        "bullets": [
            "Objective 5: Generate kitchen preparation recommendations to minimize food over-preparation and surplus.",
            "Objective 6: Implement event-driven asynchronous communication across microservices via RabbitMQ.",
            "Objective 7: Rigorously evaluate system performance using operational and technical metrics (MAE, RMSE, Latency).",
            "Objective 8: Develop a preference-aware recommendation mechanism for food and Smart Rescue deals."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 13: Project Scope
# -------------------------------------------------------------
format_card_slide(prs.slides[12], "Project Scope & Boundary Definitions", [
    {
        "title": "In-Scope Capabilities",
        "bullets": [
            "Customer ordering, order tracking, dietary preference recommendations, and rescue offer checkout.",
            "Restaurant profile management, live order workflow, demand forecast dashboard, and surplus posting.",
            "Delivery partner app: availability toggle, dispatch notifications, route navigation view.",
            "Admin portal: platform monitoring, user management, and operational analytics."
        ]
    },
    {
        "title": "Out-of-Scope Elements",
        "bullets": [
            "Banking payment gateway settlement, autonomous drone delivery, nationwide freight logistics, real-time physical traffic video analysis."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 14: Requirements
# -------------------------------------------------------------
format_card_slide(prs.slides[13], "Functional & Non-Functional Requirements", [
    {
        "title": "Functional Requirements",
        "bullets": [
            "User Auth & RBAC (Customer, Restaurant, Driver, Admin).",
            "Real-time Order Lifecycle & Asynchronous Event Dispatch.",
            "ML Demand Forecasting & Dynamic Preparation Guidance.",
            "Multi-Factor Delivery Allocation & ETA Calculation.",
            "Smart Food Rescue & Preference-Aware Deals Engine."
        ]
    },
    {
        "title": "Non-Functional Requirements",
        "bullets": [
            "Scalability: Decoupled Spring Boot microservices.",
            "Availability & Reliability: Circuit breakers & RabbitMQ retries.",
            "Performance: Low-latency API response (< 200ms via Redis caching).",
            "Maintainability: Modular architecture & clean containerization."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 15: Proposed Intelligent Layer
# -------------------------------------------------------------
format_card_slide(prs.slides[14], "Proposed Intelligent Layer & Smart Food Rescue", [
    {
        "title": "Intelligent Platform Layer",
        "bullets": [
            "Enriches standard delivery CRUD operations with machine learning decision support.",
            "Continuous sync between forecast predictions, actual orders, and driver availability."
        ]
    },
    {
        "title": "Smart Food Rescue Engine",
        "bullets": [
            "Handles surplus food and prepared order cancellations via automated rescue deals.",
            "Dynamic discounting up to 70% based on shelf-life and proximity matching (< 3km).",
            "Transforms potential financial loss and carbon waste into customer value."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 18: Database Architecture
# -------------------------------------------------------------
format_card_slide(prs.slides[17], "Database Architecture & Data Collections", [
    {
        "title": "Polyglot Persistence Layer",
        "bullets": [
            "MongoDB: Primary semi-structured document store for high-throughput flexible schema operations.",
            "Redis: In-memory cache for ultra-low latency driver GPS location tracking and active sessions."
        ]
    },
    {
        "title": "Core MongoDB Collections",
        "bullets": [
            "Users, Restaurants, Menus, Orders, Deliveries, DemandData, WasteRecords, RescueOffers, Preferences, DemandForecasts, ETARecords."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 19: Expected Outcomes & Evaluation
# -------------------------------------------------------------
format_card_slide(prs.slides[18], "Expected Outcomes & Evaluation Framework", [
    {
        "title": "Key Project Outcomes",
        "bullets": [
            "Enhanced demand visibility & forecast-driven kitchen preparation planning.",
            "Optimized delivery assignment reducing average delivery latency and driver idle time.",
            "Direct reduction in restaurant food surplus via Smart Rescue deals.",
            "Robust event-driven distributed system architecture."
        ]
    },
    {
        "title": "Technical Evaluation Metrics",
        "bullets": [
            "Forecasting & ETA: MAE (Mean Absolute Error), RMSE, MAPE.",
            "Delivery Optimization: Average transit time, total distance traveled, driver utilization %.",
            "Waste Management: Surplus volume recovered (kg) & waste reduction %.",
            "System Performance: API latency (ms) & RabbitMQ message throughput."
        ]
    }
])

# -------------------------------------------------------------
# SLIDE 20: Future Scope & Conclusion
# -------------------------------------------------------------
format_card_slide(prs.slides[19], "Future Scope & Project Conclusion", [
    {
        "title": "Future Scope & Enhancements",
        "bullets": [
            "Integration of real-time physical traffic API & weather condition vectors.",
            "Reinforcement Learning (RL) based continuous dynamic dispatch optimization.",
            "Cross-restaurant collaborative surplus bundling & carbon-aware routing."
        ]
    },
    {
        "title": "Dissertation Conclusion",
        "bullets": [
            "SmartEats successfully bridges the gap between machine-learning analytics and live delivery platform operations.",
            "Transforms food delivery from a reactive logistics framework into an intelligent, sustainable, event-driven ecosystem."
        ]
    }
])

# Save upgraded presentation
out_pptx = 'SmartEats_Presentation_Upgraded.pptx'
prs.save(out_pptx)
prs.save(prs_path)
print(f"Presentation saved successfully to '{out_pptx}' and '{prs_path}'!")
