#!/usr/bin/env python3
"""Generate KingVision Fitness business progress report PDF."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from fpdf import FPDF

OUTPUT = Path(__file__).resolve().parent / "KingVision_Fitness_Progress_Report_2026-05-29.pdf"

GOLD = (212, 175, 55)
DARK = (31, 41, 55)
TEXT = (17, 24, 39)
MUTED = (107, 114, 128)
WHITE = (255, 255, 255)
LIGHT_BG = (247, 247, 251)
GREEN = (34, 197, 94)
AMBER = (245, 158, 11)
RED = (239, 68, 68)


class ProgressReportPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(format="Letter")
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(18, 18, 18)

    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "KingVision Fitness - Progress Report", align="L")
        self.cell(0, 8, f"Page {self.page_no()}", align="R", new_x="LMARGIN", new_y="NEXT")

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "Confidential - prepared for business stakeholders", align="C")

    def section_title(self, title: str) -> None:
        self.ln(4)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*DARK)
        self.cell(0, 9, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*GOLD)
        self.set_line_width(0.6)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(5)

    def body_text(self, text: str) -> None:
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*TEXT)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def progress_bar(self, label: str, pct: int) -> None:
        bar_x = self.l_margin
        bar_y = self.get_y() + 1
        bar_w = self.w - self.l_margin - self.r_margin
        bar_h = 5
        fill_w = max(0, min(bar_w, bar_w * pct / 100))

        self.set_font("Helvetica", "", 9)
        self.set_text_color(*TEXT)
        self.cell(bar_w * 0.62, 5, label)
        self.set_font("Helvetica", "B", 9)
        self.cell(bar_w * 0.38, 5, f"{pct}%", align="R", new_x="LMARGIN", new_y="NEXT")

        self.set_fill_color(229, 231, 235)
        self.rect(bar_x, bar_y, bar_w, bar_h, style="F")

        if pct >= 70:
            color = GREEN
        elif pct >= 40:
            color = AMBER
        else:
            color = RED
        self.set_fill_color(*color)
        if fill_w > 0:
            self.rect(bar_x, bar_y, fill_w, bar_h, style="F")

        self.ln(8)

    def table_row(self, cols: list[str], widths: list[float], header: bool = False) -> None:
        if header:
            self.set_font("Helvetica", "B", 9)
            self.set_fill_color(*DARK)
            self.set_text_color(*WHITE)
        else:
            self.set_font("Helvetica", "", 9)
            self.set_fill_color(*LIGHT_BG if self.get_y() % 2 else WHITE)
            self.set_text_color(*TEXT)

        row_h = 7
        x_start = self.l_margin
        y_start = self.get_y()

        for i, (col, w) in enumerate(zip(cols, widths)):
            x = x_start + sum(widths[:i])
            self.set_xy(x, y_start)
            self.cell(w, row_h, col, border=0, fill=True)

        self.set_xy(x_start, y_start + row_h)


def build_pdf() -> None:
    pdf = ProgressReportPDF()
    pdf.add_page()

    # Cover block
    pdf.set_fill_color(*DARK)
    pdf.rect(0, 0, pdf.w, 52, style="F")
    pdf.set_xy(18, 14)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 10, "KingVision Fitness")
    pdf.set_xy(18, 26)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(*GOLD)
    pdf.cell(0, 8, "Mobile App Progress Report")
    pdf.set_xy(18, 36)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(200, 200, 200)
    pdf.cell(0, 6, f"Prepared for Business Owner  |  {date.today().strftime('%B %d, %Y')}")

    pdf.set_y(62)

    # Overall score hero
    pdf.set_fill_color(255, 251, 235)
    pdf.set_draw_color(*GOLD)
    pdf.rect(pdf.l_margin, pdf.get_y(), pdf.w - 36, 28, style="FD")
    pdf.set_xy(pdf.l_margin + 6, pdf.get_y() + 6)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*DARK)
    pdf.cell(90, 6, "OVERALL COMPLETION")
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(*GOLD)
    pdf.set_xy(pdf.l_margin + 6, pdf.get_y() + 8)
    pdf.cell(60, 14, "58%")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MUTED)
    pdf.set_xy(pdf.l_margin + 70, pdf.get_y() - 2)
    pdf.multi_cell(110, 5, "Strong MVP core for training, scheduling, and admin content. Not yet ready for paid public launch without Stripe and production deployment.")

    pdf.set_y(pdf.get_y() + 16)

    pdf.section_title("Executive Summary")
    pdf.body_text(
        "KingVision Fitness is a mobile-first fitness platform with a companion API. "
        "Clients can browse workouts, log training sessions, join teams, book 1-on-1 sessions, "
        "and view nutrition content. Super Admins operate a dedicated command center for analytics, "
        "content publishing, team management, and scheduling."
    )
    pdf.body_text(
        "The product is suitable for internal pilot and demo with manually assigned Active Client "
        "access. Revenue launch requires Stripe payments, subscription lifecycle automation, and "
        "a production-hosted backend."
    )

    pdf.section_title("Completion by Pillar")
    pillar_widths = [62, 22, 106]
    pdf.table_row(["Pillar", "Score", "Summary"], pillar_widths, header=True)
    pillars = [
        ("Client mobile app", "78%", "Training, home, groups, booking, nutrition usable"),
        ("Admin / coach portal", "72%", "Content, teams, schedule, analytics built"),
        ("Backend & data", "68%", "Most APIs live; payments & chat are stubs"),
        ("Monetization & billing", "15%", "Tier structure exists; Stripe not wired"),
        ("Infrastructure & launch", "40%", "CI exists; no Docker or deploy pipeline"),
    ]
    for row in pillars:
        pdf.table_row(list(row), pillar_widths)
    pdf.ln(4)

    pdf.section_title("Feature Completion Snapshot")
    features = [
        ("Authentication & accounts", 82),
        ("Workout training flow", 88),
        ("Groups & community", 85),
        ("Scheduling & booking", 82),
        ("Nutrition", 75),
        ("Admin content & teams", 85),
        ("Admin analytics dashboard", 85),
        ("Membership / payments (Stripe)", 15),
        ("Messaging & chat", 20),
        ("Production deployment", 35),
        ("Automated testing", 30),
    ]
    for label, pct in features:
        pdf.progress_bar(label, pct)

    pdf.add_page()
    pdf.section_title("What Is Done (High Confidence)")
    done_items = [
        "Authentication - sign up, login, secure token storage, role-based routing",
        "Home dashboard - stats, tier-aware shortcuts, weekly plan preview",
        "Workouts - weekly public and custom client libraries with search/filter",
        "Active workout player - timer, set logging, crash recovery, completion logging",
        "Admin workout editor - edit published templates without altering session history",
        "Drift detection - protects clients mid-workout when coaches edit plans",
        "Groups & teams - invite codes, leaderboards, geo check-in, coach athlete views",
        "1-on-1 booking - client booking flow and admin schedule management",
        "Nutrition - weekly guides and macro plan publishing (admin + client views)",
        "Admin command center - live MRR estimate, user tiers, weekly engagement metrics",
        "Enterprise security baseline - JWT hardening, rate limiting, env validation, CI",
    ]
    for item in done_items:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*TEXT)
        pdf.cell(4, 5, "-")
        pdf.multi_cell(0, 5.5, item)
        pdf.ln(1)

    pdf.section_title("What Still Needs Completion")
    pdf.table_row(["Priority", "Item", "Status"], [22, 88, 80], header=True)
    gaps = [
        ("Critical", "Stripe checkout & subscriptions", "Stub - 501 response"),
        ("Critical", "Production backend deployment", "Not deployed"),
        ("Critical", "App Store / TestFlight release", "EAS config started"),
        ("Important", "In-app messaging / chat", "REST + socket stub only"),
        ("Important", "Admin billing dashboard", "Placeholder screen"),
        ("Important", "Profile editing & progress tracking", "Backend stubs"),
        ("Important", "Client push notifications", "No device registration"),
        ("Phase 2", "AI workout recommendations", "Rules engine only"),
        ("Phase 2", "Docker / containerized deploy", "Not started"),
        ("Phase 2", "End-to-end automated tests", "Minimal coverage"),
    ]
    for row in gaps:
        pdf.table_row(list(row), [22, 88, 80])
    pdf.ln(4)

    pdf.section_title("Recommended Milestones")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 6, "Next milestone - target ~75% overall", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*TEXT)
    for step in [
        "1. Stripe checkout and subscription webhooks",
        "2. Deploy backend to production (Railway, Render, AWS, etc.)",
        "3. Admin billing tab (read-only Stripe link acceptable)",
        "4. TestFlight / internal build for owner review",
    ]:
        pdf.cell(0, 5.5, step, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 6, "Launch milestone - target ~90% overall", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*TEXT)
    for step in [
        "1. Messaging or remove from tier marketing",
        "2. Client push notification registration",
        "3. Profile editing in the mobile app",
        "4. E2E tests on auth, workout complete, and booking flows",
    ]:
        pdf.cell(0, 5.5, step, new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)
    pdf.set_fill_color(*DARK)
    pdf.rect(pdf.l_margin, pdf.get_y(), pdf.w - 36, 22, style="F")
    pdf.set_xy(pdf.l_margin + 6, pdf.get_y() + 5)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*GOLD)
    pdf.cell(0, 6, "Bottom Line for the Business Owner")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(pdf.l_margin + 6, pdf.get_y() + 2)
    pdf.multi_cell(
        pdf.w - 48,
        5,
        "Demo and pilot today with real training, scheduling, and admin workflows. "
        "Paid subscription launch after Stripe and production hosting are complete.",
    )

    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
