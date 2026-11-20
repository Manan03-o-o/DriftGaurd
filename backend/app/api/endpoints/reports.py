from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.report_service import ReportService
from app.services.model_service import ModelService

router = APIRouter()


@router.get("/model/{model_id}")
def get_model_report(model_id: str, db: Session = Depends(get_db)):
    try:
        if model_id == "default" or not model_id:
            active = ModelService.get_active_or_latest_model(db)
            if not active:
                active = ModelService.ensure_default_model(db)
            model_id = active.id

        report = ReportService.generate_comprehensive_report(db, model_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/model/{model_id}/html", response_class=HTMLResponse)
def get_printable_html_report(model_id: str, db: Session = Depends(get_db)):
    try:
        if model_id == "default" or not model_id:
            active = ModelService.get_active_or_latest_model(db)
            if not active:
                active = ModelService.ensure_default_model(db)
            model_id = active.id

        rep = ReportService.generate_comprehensive_report(db, model_id)
        meta = rep["metadata"]
        m = rep["model_overview"]
        mon = rep["monitoring_summary"]
        dq = rep["data_quality_summary"]
        pq = rep["predictive_quality"]
        alerts = rep["alerts_summary"]

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DriftGuard Monitoring Audit - {m['name']}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 40px; margin: 0; line-height: 1.5; }}
    .container {{ max-width: 900px; margin: 0 auto; background: #131a2a; padding: 40px; border-radius: 16px; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
    .header {{ border-bottom: 2px solid #312e81; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }}
    h1 {{ color: #ffffff; margin: 0 0 8px 0; font-size: 24px; }}
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: #312e81; color: #818cf8; }}
    .grid-4 {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }}
    .card {{ background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; }}
    .card-label {{ font-size: 11px; color: #94a3b8; font-family: monospace; text-transform: uppercase; }}
    .card-val {{ font-size: 22px; font-weight: bold; color: #ffffff; margin-top: 4px; }}
    h2 {{ font-size: 16px; color: #818cf8; border-bottom: 1px solid #1e293b; padding-bottom: 8px; margin-top: 30px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; font-family: monospace; }}
    th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #1e293b; }}
    th {{ background: #0f172a; color: #94a3b8; }}
    .rec-box {{ background: #1e1b4b; border-left: 4px solid #6366f1; padding: 16px; border-radius: 8px; margin-top: 24px; }}
    .footer {{ margin-top: 40px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 20px; }}
    @media print {{
      body {{ background: #ffffff; color: #0f172a; padding: 0; }}
      .container {{ box-shadow: none; border: none; padding: 0; max-width: 100%; }}
      .card {{ background: #f8fafc; border-color: #cbd5e1; }}
      .card-val {{ color: #0f172a; }}
      th {{ background: #f1f5f9; color: #475569; }}
      td {{ border-color: #e2e8f0; }}
      .rec-box {{ background: #eef2ff; border-color: #4f46e5; color: #1e1b4b; }}
      .badge {{ background: #e0e7ff; color: #3730a3; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <span class="badge">AUDIT REPORT: {meta['report_id']}</span>
        <h1 style="margin-top: 8px;">DriftGuard Model Reliability Audit</h1>
        <div style="font-size: 12px; color: #94a3b8;">
          Model: <strong>{m['name']}</strong> (v{m['version']}) &bull; Algorithm: {m['algorithm']}
        </div>
      </div>
      <div style="text-align: right; font-size: 11px; color: #94a3b8;">
        Generated: {meta['generated_at'][:19].replace('T', ' ')} UTC<br>
        <button onclick="window.print()" style="margin-top: 8px; padding: 6px 12px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold;">Print to PDF</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-label">Baseline Macro-F1</div>
        <div class="card-val">{m['baseline_f1']:.4f}</div>
      </div>
      <div class="card">
        <div class="card-label">Current Macro-F1</div>
        <div class="card-val" style="color: {'#10b981' if pq['delta_f1'] >= 0 else '#f43f5e'};">{pq['latest_macro_f1']:.4f}</div>
      </div>
      <div class="card">
        <div class="card-label">Windows Analyzed</div>
        <div class="card-val">{mon['total_windows_analyzed']}</div>
      </div>
      <div class="card">
        <div class="card-label">Data Quality Score</div>
        <div class="card-val" style="color: {'#10b981' if dq['latest_score'] >= 90 else '#f59e0b'};">{dq['latest_score']:.1f}%</div>
      </div>
    </div>

    <h2>1. Statistical Drift Diagnostics</h2>
    <p style="font-size: 12px; color: #94a3b8;">
      Evaluated using Two-Sample Kolmogorov-Smirnov test (continuous), Chi-square (categorical),
      Benjamini-Hochberg FDR control (&alpha;=0.05), Population Stability Index (PSI), and Normalized Wasserstein distance.
    </p>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
          <th>Standard Reference Baseline</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Latest Window Severity</td>
          <td><strong>{mon['latest_window_status']}</strong></td>
          <td>NONE / STABLE</td>
        </tr>
        <tr>
          <td>Windows Flagged Medium/High</td>
          <td>{mon['drifted_windows_count']} / {mon['total_windows_analyzed']}</td>
          <td>0 Windows</td>
        </tr>
        <tr>
          <td>Average Population Stability Index (PSI)</td>
          <td>{mon['average_psi']:.4f}</td>
          <td>&lt; 0.10 (Stable)</td>
        </tr>
      </tbody>
    </table>

    <h2>2. Data Ingestion Quality Audit</h2>
    <table>
      <thead>
        <tr>
          <th>Quality Check</th>
          <th>Result</th>
          <th>Acceptable Tolerance</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Records Audited</td>
          <td>{dq['records_count']:,} observations</td>
          <td>&ge; 100 rows</td>
        </tr>
        <tr>
          <td>Missing Values Rate</td>
          <td>{dq['missing_percentage']:.2f}%</td>
          <td>&lt; 5.0%</td>
        </tr>
        <tr>
          <td>Duplicate Observations</td>
          <td>{dq['duplicate_count']} rows</td>
          <td>0 duplicates</td>
        </tr>
        <tr>
          <td>IQR Numerical Outliers</td>
          <td>{dq['outlier_count']} values</td>
          <td>&lt; 10% expected</td>
        </tr>
      </tbody>
    </table>

    <h2>3. Automated Operational Recommendations</h2>
    <div class="rec-box">
      {"<br><br>".join(f"&bull; {r}" for r in rep['recommendations'])}
    </div>

    <div class="footer">
      DriftGuard ML Model Observability & Retraining Benchmark Platform &bull; Academic Viva Evaluation Ready
    </div>
  </div>
</body>
</html>"""
        return HTMLResponse(content=html_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HTML report render failed: {str(e)}")
