#!/usr/bin/env python3
"""
Quality Dashboard for MediaNest Documentation
Comprehensive quality metrics dashboard and monitoring system.
"""

import os
import json
import time
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Set, Optional, Tuple, Any
import logging
from datetime import datetime, timedelta
import subprocess
import argparse

# Import our QA modules
from comprehensive_link_checker import ComprehensiveLinkChecker
from formatting_validator import FormattingValidator
from accessibility_tester import AccessibilityTester
from mobile_responsiveness_tester import MobileResponsivenessTester
from performance_monitor import PerformanceMonitor

@dataclass
class QualityMetrics:
    """Overall quality metrics for documentation"""
    overall_score: float
    link_check_score: float
    formatting_score: float
    accessibility_score: float
    mobile_score: float
    performance_score: float
    timestamp: datetime
    total_issues: int
    critical_issues: int
    recommendations_count: int

class QualityDashboard:
    """Comprehensive quality dashboard for documentation QA"""
    
    def __init__(self, docs_dir: str = "docs", site_url: str = "http://localhost:8000"):
        self.docs_dir = Path(docs_dir)
        self.site_url = site_url
        self.results_dir = Path("tests/docs-qa/results")
        self.results_dir.mkdir(parents=True, exist_ok=True)
        
        # Configure logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Quality gates
        self.quality_gates = {
            'overall_score': 85.0,
            'link_check_score': 95.0,
            'formatting_score': 90.0,
            'accessibility_score': 85.0,
            'mobile_score': 80.0,
            'performance_score': 75.0,
            'critical_issues': 0,
            'total_issues': 50
        }
        
        # Initialize QA modules
        self.link_checker = ComprehensiveLinkChecker(str(self.docs_dir))
        self.formatting_validator = FormattingValidator(str(self.docs_dir))
        self.accessibility_tester = AccessibilityTester(str(self.docs_dir))
        self.mobile_tester = MobileResponsivenessTester(self.site_url)
        self.performance_monitor = PerformanceMonitor(str(self.docs_dir), self.site_url)
    
    async def run_comprehensive_qa(self, skip_modules: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run comprehensive quality assurance testing"""
        skip_modules = skip_modules or []
        
        self.logger.info("🚀 Starting comprehensive documentation QA")
        start_time = time.time()
        
        qa_results = {
            'timestamp': datetime.now().isoformat(),
            'execution_time': 0,
            'modules_executed': [],
            'modules_skipped': skip_modules,
            'results': {},
            'quality_metrics': None,
            'quality_gates': {},
            'summary': {},
            'recommendations': []
        }
        
        try:
            # 1. Link Checking
            if 'links' not in skip_modules:
                self.logger.info("🔗 Running comprehensive link checking...")
                link_results = await self.link_checker.check_all_links()
                qa_results['results']['link_check'] = link_results
                qa_results['modules_executed'].append('link_check')
                self._save_module_report('link_check', link_results)
            
            # 2. Formatting Validation
            if 'formatting' not in skip_modules:
                self.logger.info("📋 Running formatting validation...")
                formatting_results = self.formatting_validator.validate_all_files()
                qa_results['results']['formatting'] = formatting_results
                qa_results['modules_executed'].append('formatting')
                self._save_module_report('formatting', formatting_results)
            
            # 3. Accessibility Testing
            if 'accessibility' not in skip_modules:
                self.logger.info("♿ Running accessibility testing...")
                accessibility_results = self.accessibility_tester.test_accessibility()
                qa_results['results']['accessibility'] = accessibility_results
                qa_results['modules_executed'].append('accessibility')
                self._save_module_report('accessibility', accessibility_results)
            
            # 4. Mobile Responsiveness Testing
            if 'mobile' not in skip_modules:
                self.logger.info("📱 Running mobile responsiveness testing...")
                mobile_results = self.mobile_tester.test_responsiveness()
                qa_results['results']['mobile'] = mobile_results
                qa_results['modules_executed'].append('mobile')
                self._save_module_report('mobile', mobile_results)
            
            # 5. Performance Monitoring
            if 'performance' not in skip_modules:
                self.logger.info("⚡ Running performance monitoring...")
                performance_results = self.performance_monitor.monitor_performance()
                qa_results['results']['performance'] = performance_results
                qa_results['modules_executed'].append('performance')
                self._save_module_report('performance', performance_results)
            
            # Calculate execution time
            qa_results['execution_time'] = time.time() - start_time
            
            # Generate quality metrics
            quality_metrics = self._calculate_quality_metrics(qa_results['results'])
            qa_results['quality_metrics'] = asdict(quality_metrics)
            
            # Check quality gates
            qa_results['quality_gates'] = self._check_quality_gates(quality_metrics)
            
            # Generate summary
            qa_results['summary'] = self._generate_summary(qa_results)
            
            # Generate recommendations
            qa_results['recommendations'] = self._generate_comprehensive_recommendations(qa_results['results'])
            
            # Save comprehensive report
            self._save_comprehensive_report(qa_results)
            
            # Generate dashboard HTML
            self._generate_html_dashboard(qa_results)
            
        except Exception as e:
            self.logger.error(f"Error during QA execution: {e}")
            qa_results['error'] = str(e)
        
        return qa_results
    
    def _calculate_quality_metrics(self, results: Dict[str, Any]) -> QualityMetrics:
        """Calculate overall quality metrics from module results"""
        # Extract scores from each module
        link_score = 100.0
        if 'link_check' in results:
            link_data = results['link_check'].get('summary', {})
            link_score = link_data.get('success_rate', 100.0)
        
        formatting_score = 100.0
        if 'formatting' in results:
            formatting_data = results['formatting'].get('summary', {})
            formatting_score = formatting_data.get('quality_score', 100.0)
        
        accessibility_score = 100.0
        if 'accessibility' in results:
            accessibility_data = results['accessibility'].get('summary', {})
            accessibility_score = accessibility_data.get('accessibility_score', 100.0)
        
        mobile_score = 100.0
        if 'mobile' in results:
            if 'error' not in results['mobile']:
                mobile_data = results['mobile'].get('summary', {})
                mobile_score = mobile_data.get('responsiveness_score', 100.0)
        
        performance_score = 100.0
        if 'performance' in results:
            if 'error' not in results['performance']:
                performance_data = results['performance'].get('summary', {})
                performance_score = performance_data.get('performance_score', 100.0)
        
        # Calculate overall score (weighted average)
        weights = {
            'link_score': 0.25,
            'formatting_score': 0.20,
            'accessibility_score': 0.25,
            'mobile_score': 0.15,
            'performance_score': 0.15
        }
        
        overall_score = (
            link_score * weights['link_score'] +
            formatting_score * weights['formatting_score'] +
            accessibility_score * weights['accessibility_score'] +
            mobile_score * weights['mobile_score'] +
            performance_score * weights['performance_score']
        )
        
        # Count total issues and critical issues
        total_issues = 0
        critical_issues = 0
        recommendations_count = 0
        
        for module_name, module_results in results.items():
            if isinstance(module_results, dict):
                # Count issues based on module structure
                if 'broken_links' in module_results:
                    total_issues += len(module_results['broken_links'])
                    critical_issues += len(module_results['broken_links'])
                
                if 'detailed_issues' in module_results:
                    issues = module_results['detailed_issues']
                    total_issues += len(issues)
                    critical_issues += len([i for i in issues if i.get('severity') == 'critical'])
                
                if 'summary' in module_results and 'critical_issues' in module_results['summary']:
                    critical_issues += module_results['summary']['critical_issues']
                    total_issues += module_results['summary'].get('total_issues', 0)
                
                if 'recommendations' in module_results:
                    recommendations_count += len(module_results['recommendations'])
        
        return QualityMetrics(
            overall_score=round(overall_score, 1),
            link_check_score=round(link_score, 1),
            formatting_score=round(formatting_score, 1),
            accessibility_score=round(accessibility_score, 1),
            mobile_score=round(mobile_score, 1),
            performance_score=round(performance_score, 1),
            timestamp=datetime.now(),
            total_issues=total_issues,
            critical_issues=critical_issues,
            recommendations_count=recommendations_count
        )
    
    def _check_quality_gates(self, metrics: QualityMetrics) -> Dict[str, Any]:
        """Check if quality gates are passed"""
        gate_results = {}
        
        for gate_name, threshold in self.quality_gates.items():
            metric_value = getattr(metrics, gate_name, 0)
            
            if gate_name in ['critical_issues']:
                # For critical issues, we want 0 or less
                passed = metric_value <= threshold
            elif gate_name in ['total_issues']:
                # For total issues, we want less than threshold
                passed = metric_value < threshold
            else:
                # For scores, we want above threshold
                passed = metric_value >= threshold
            
            gate_results[gate_name] = {
                'threshold': threshold,
                'actual': metric_value,
                'passed': passed,
                'status': 'PASS' if passed else 'FAIL'
            }
        
        # Overall gate status
        all_passed = all(gate['passed'] for gate in gate_results.values())
        gate_results['overall'] = {
            'status': 'PASS' if all_passed else 'FAIL',
            'passed_gates': len([g for g in gate_results.values() if g['passed']]),
            'total_gates': len(gate_results)
        }
        
        return gate_results
    
    def _generate_summary(self, qa_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary of QA results"""
        quality_metrics = qa_results.get('quality_metrics', {})
        quality_gates = qa_results.get('quality_gates', {})
        
        return {
            'overall_status': 'PASS' if quality_gates.get('overall', {}).get('status') == 'PASS' else 'FAIL',
            'quality_score': quality_metrics.get('overall_score', 0),
            'total_modules': len(qa_results.get('modules_executed', [])),
            'execution_time': round(qa_results.get('execution_time', 0), 2),
            'critical_issues': quality_metrics.get('critical_issues', 0),
            'total_issues': quality_metrics.get('total_issues', 0),
            'recommendations': quality_metrics.get('recommendations_count', 0),
            'quality_gates_passed': quality_gates.get('overall', {}).get('passed_gates', 0),
            'quality_gates_total': quality_gates.get('overall', {}).get('total_gates', 0)
        }
    
    def _generate_comprehensive_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate comprehensive recommendations across all modules"""
        all_recommendations = []
        
        # Collect recommendations from all modules
        for module_name, module_results in results.items():
            if isinstance(module_results, dict) and 'recommendations' in module_results:
                module_recs = module_results['recommendations']
                # Add module prefix for clarity
                prefixed_recs = [f"[{module_name.title()}] {rec}" for rec in module_recs]
                all_recommendations.extend(prefixed_recs)
        
        # Add high-level recommendations
        high_level_recs = [
            "🔄 Integrate QA testing into CI/CD pipeline for continuous quality monitoring",
            "📊 Set up automated quality gates to prevent regression",
            "👥 Establish documentation review process with quality checklist",
            "📈 Monitor quality metrics trends over time",
            "🎯 Prioritize critical and high-severity issues first",
            "📚 Create documentation style guide and enforce consistency",
            "🧪 Include QA testing in development workflow",
            "📱 Ensure mobile-first approach in documentation design"
        ]
        
        all_recommendations.extend(high_level_recs)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_recommendations = []
        for rec in all_recommendations:
            if rec not in seen:
                seen.add(rec)
                unique_recommendations.append(rec)
        
        return unique_recommendations
    
    def _save_module_report(self, module_name: str, results: Dict[str, Any]):
        """Save individual module report"""
        report_path = self.results_dir / f"{module_name}_report.json"
        
        with open(report_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        self.logger.info(f"📄 {module_name.title()} report saved to {report_path}")
    
    def _save_comprehensive_report(self, qa_results: Dict[str, Any]):
        """Save comprehensive QA report"""
        report_path = self.results_dir / "comprehensive_qa_report.json"
        
        with open(report_path, 'w') as f:
            json.dump(qa_results, f, indent=2, default=str)
        
        self.logger.info(f"📄 Comprehensive QA report saved to {report_path}")
    
    def _generate_html_dashboard(self, qa_results: Dict[str, Any]):
        """Generate HTML dashboard for quality metrics"""
        quality_metrics = qa_results.get('quality_metrics', {})
        quality_gates = qa_results.get('quality_gates', {})
        summary = qa_results.get('summary', {})
        
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MediaNest Documentation Quality Dashboard</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .dashboard {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        
        .header {{
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        
        .header h1 {{
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }}
        
        .header p {{
            font-size: 1.1rem;
            opacity: 0.9;
        }}
        
        .status-banner {{
            padding: 20px;
            text-align: center;
            font-weight: bold;
            font-size: 1.2rem;
        }}
        
        .status-pass {{
            background: #d4edda;
            color: #155724;
        }}
        
        .status-fail {{
            background: #f8d7da;
            color: #721c24;
        }}
        
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 30px;
        }}
        
        .metric-card {{
            background: #f8f9fa;
            border-radius: 15px;
            padding: 25px;
            border-left: 5px solid #007bff;
            transition: transform 0.3s ease;
        }}
        
        .metric-card:hover {{
            transform: translateY(-5px);
        }}
        
        .metric-title {{
            font-size: 0.9rem;
            color: #6c757d;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        
        .metric-value {{
            font-size: 2.5rem;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }}
        
        .metric-unit {{
            font-size: 1rem;
            color: #6c757d;
        }}
        
        .score-excellent {{ border-left-color: #28a745; }}
        .score-good {{ border-left-color: #17a2b8; }}
        .score-warning {{ border-left-color: #ffc107; }}
        .score-danger {{ border-left-color: #dc3545; }}
        
        .quality-gates {{
            padding: 30px;
            background: #f8f9fa;
        }}
        
        .quality-gates h2 {{
            margin-bottom: 20px;
            color: #333;
        }}
        
        .gate-item {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            margin-bottom: 10px;
            background: white;
            border-radius: 8px;
            border-left: 4px solid transparent;
        }}
        
        .gate-pass {{
            border-left-color: #28a745;
        }}
        
        .gate-fail {{
            border-left-color: #dc3545;
        }}
        
        .gate-status {{
            font-weight: bold;
            padding: 4px 12px;
            border-radius: 20px;
            color: white;
            font-size: 0.8rem;
        }}
        
        .status-pass-badge {{
            background: #28a745;
        }}
        
        .status-fail-badge {{
            background: #dc3545;
        }}
        
        .recommendations {{
            padding: 30px;
        }}
        
        .recommendations h2 {{
            margin-bottom: 20px;
            color: #333;
        }}
        
        .recommendation-item {{
            padding: 15px;
            margin-bottom: 10px;
            background: #e3f2fd;
            border-radius: 8px;
            border-left: 4px solid #2196f3;
        }}
        
        .footer {{
            padding: 20px 30px;
            background: #f8f9fa;
            border-top: 1px solid #dee2e6;
            text-align: center;
            color: #6c757d;
        }}
        
        .progress-bar {{
            width: 100%;
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 10px;
        }}
        
        .progress-fill {{
            height: 100%;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            transition: width 0.5s ease;
        }}
        
        @media (max-width: 768px) {{
            .metrics-grid {{
                grid-template-columns: 1fr;
            }}
            
            .header h1 {{
                font-size: 2rem;
            }}
            
            .dashboard {{
                margin: 10px;
            }}
        }}
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>📊 Documentation Quality Dashboard</h1>
            <p>MediaNest Documentation Quality Assurance Report</p>
            <p>Generated: {quality_metrics.get('timestamp', 'N/A')}</p>
        </div>
        
        <div class="status-banner {'status-pass' if summary.get('overall_status') == 'PASS' else 'status-fail'}">
            🎯 Overall Status: {summary.get('overall_status', 'UNKNOWN')} 
            (Score: {quality_metrics.get('overall_score', 0)}/100)
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card {self._get_score_class(quality_metrics.get('overall_score', 0))}">
                <div class="metric-title">Overall Quality Score</div>
                <div class="metric-value">{quality_metrics.get('overall_score', 0)}</div>
                <div class="metric-unit">/ 100</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {quality_metrics.get('overall_score', 0)}%"></div>
                </div>
            </div>
            
            <div class="metric-card {self._get_score_class(quality_metrics.get('link_check_score', 0))}">
                <div class="metric-title">🔗 Link Validation</div>
                <div class="metric-value">{quality_metrics.get('link_check_score', 0)}</div>
                <div class="metric-unit">% success rate</div>
            </div>
            
            <div class="metric-card {self._get_score_class(quality_metrics.get('formatting_score', 0))}">
                <div class="metric-title">📋 Formatting Quality</div>
                <div class="metric-value">{quality_metrics.get('formatting_score', 0)}</div>
                <div class="metric-unit">/ 100</div>
            </div>
            
            <div class="metric-card {self._get_score_class(quality_metrics.get('accessibility_score', 0))}">
                <div class="metric-title">♿ Accessibility</div>
                <div class="metric-value">{quality_metrics.get('accessibility_score', 0)}</div>
                <div class="metric-unit">/ 100</div>
            </div>
            
            <div class="metric-card {self._get_score_class(quality_metrics.get('mobile_score', 0))}">
                <div class="metric-title">📱 Mobile Friendly</div>
                <div class="metric-value">{quality_metrics.get('mobile_score', 0)}</div>
                <div class="metric-unit">/ 100</div>
            </div>
            
            <div class="metric-card {self._get_score_class(quality_metrics.get('performance_score', 0))}">
                <div class="metric-title">⚡ Performance</div>
                <div class="metric-value">{quality_metrics.get('performance_score', 0)}</div>
                <div class="metric-unit">/ 100</div>
            </div>
            
            <div class="metric-card score-{'danger' if quality_metrics.get('critical_issues', 0) > 0 else 'excellent'}">
                <div class="metric-title">🚨 Critical Issues</div>
                <div class="metric-value">{quality_metrics.get('critical_issues', 0)}</div>
                <div class="metric-unit">issues</div>
            </div>
            
            <div class="metric-card score-warning">
                <div class="metric-title">📋 Total Issues</div>
                <div class="metric-value">{quality_metrics.get('total_issues', 0)}</div>
                <div class="metric-unit">issues</div>
            </div>
        </div>
        
        <div class="quality-gates">
            <h2>🎯 Quality Gates</h2>
            {self._generate_quality_gates_html(quality_gates)}
        </div>
        
        <div class="recommendations">
            <h2>💡 Recommendations</h2>
            {self._generate_recommendations_html(qa_results.get('recommendations', []))}
        </div>
        
        <div class="footer">
            <p>Generated by MediaNest Documentation QA System</p>
            <p>Execution Time: {summary.get('execution_time', 0)}s | 
               Modules: {summary.get('total_modules', 0)} | 
               Recommendations: {summary.get('recommendations', 0)}</p>
        </div>
    </div>
</body>
</html>
        """
        
        dashboard_path = self.results_dir / "quality_dashboard.html"
        
        with open(dashboard_path, 'w') as f:
            f.write(html_content)
        
        self.logger.info(f"📊 Quality dashboard generated: {dashboard_path}")
        return dashboard_path
    
    def _get_score_class(self, score: float) -> str:
        """Get CSS class based on score"""
        if score >= 90:
            return "score-excellent"
        elif score >= 75:
            return "score-good"
        elif score >= 60:
            return "score-warning"
        else:
            return "score-danger"
    
    def _generate_quality_gates_html(self, quality_gates: Dict[str, Any]) -> str:
        """Generate HTML for quality gates section"""
        html = ""
        
        for gate_name, gate_data in quality_gates.items():
            if gate_name == 'overall':
                continue
                
            status_class = "gate-pass" if gate_data.get('passed', False) else "gate-fail"
            status_badge = "status-pass-badge" if gate_data.get('passed', False) else "status-fail-badge"
            
            html += f"""
            <div class="gate-item {status_class}">
                <div>
                    <strong>{gate_name.replace('_', ' ').title()}</strong>
                    <br>
                    <small>Threshold: {gate_data.get('threshold', 'N/A')} | Actual: {gate_data.get('actual', 'N/A')}</small>
                </div>
                <div class="gate-status {status_badge}">
                    {gate_data.get('status', 'UNKNOWN')}
                </div>
            </div>
            """
        
        return html
    
    def _generate_recommendations_html(self, recommendations: List[str]) -> str:
        """Generate HTML for recommendations section"""
        html = ""
        
        for rec in recommendations[:15]:  # Limit to top 15 recommendations
            html += f"""
            <div class="recommendation-item">
                {rec}
            </div>
            """
        
        if len(recommendations) > 15:
            html += f"""
            <div class="recommendation-item" style="background: #fff3cd; border-left-color: #ffc107;">
                <strong>... and {len(recommendations) - 15} more recommendations in the detailed report</strong>
            </div>
            """
        
        return html
    
    def generate_ci_report(self, qa_results: Dict[str, Any]) -> str:
        """Generate CI-friendly report"""
        quality_metrics = qa_results.get('quality_metrics', {})
        quality_gates = qa_results.get('quality_gates', {})
        summary = qa_results.get('summary', {})
        
        report = f"""
# 📊 Documentation Quality Report

## Overall Status: {summary.get('overall_status', 'UNKNOWN')}

### Quality Metrics
- **Overall Score**: {quality_metrics.get('overall_score', 0)}/100
- **Critical Issues**: {quality_metrics.get('critical_issues', 0)}
- **Total Issues**: {quality_metrics.get('total_issues', 0)}
- **Execution Time**: {summary.get('execution_time', 0)}s

### Module Scores
- 🔗 Link Validation: {quality_metrics.get('link_check_score', 0)}/100
- 📋 Formatting: {quality_metrics.get('formatting_score', 0)}/100
- ♿ Accessibility: {quality_metrics.get('accessibility_score', 0)}/100
- 📱 Mobile: {quality_metrics.get('mobile_score', 0)}/100
- ⚡ Performance: {quality_metrics.get('performance_score', 0)}/100

### Quality Gates
"""
        
        for gate_name, gate_data in quality_gates.items():
            if gate_name == 'overall':
                continue
            
            status_emoji = "✅" if gate_data.get('passed', False) else "❌"
            report += f"- {status_emoji} {gate_name.replace('_', ' ').title()}: {gate_data.get('actual', 'N/A')} (threshold: {gate_data.get('threshold', 'N/A')})\n"
        
        if quality_metrics.get('critical_issues', 0) > 0:
            report += f"\n⚠️ **{quality_metrics.get('critical_issues', 0)} critical issues must be fixed before deployment!**\n"
        
        report += f"\n📊 Full dashboard: tests/docs-qa/results/quality_dashboard.html\n"
        
        return report

async def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(description="MediaNest Documentation Quality Dashboard")
    parser.add_argument('--skip', nargs='*', default=[], 
                       choices=['links', 'formatting', 'accessibility', 'mobile', 'performance'],
                       help='Skip specific QA modules')
    parser.add_argument('--site-url', default='http://localhost:8000',
                       help='URL of the documentation site')
    parser.add_argument('--docs-dir', default='docs',
                       help='Documentation directory')
    parser.add_argument('--ci', action='store_true',
                       help='Generate CI-friendly output')
    
    args = parser.parse_args()
    
    # Initialize dashboard
    dashboard = QualityDashboard(docs_dir=args.docs_dir, site_url=args.site_url)
    
    # Run comprehensive QA
    qa_results = await dashboard.run_comprehensive_qa(skip_modules=args.skip)
    
    # Print summary
    summary = qa_results.get('summary', {})
    quality_metrics = qa_results.get('quality_metrics', {})
    
    print(f"\n📊 Documentation Quality Assessment Complete!")
    print(f"🎯 Overall Status: {summary.get('overall_status', 'UNKNOWN')}")
    print(f"📈 Quality Score: {quality_metrics.get('overall_score', 0)}/100")
    print(f"🚨 Critical Issues: {quality_metrics.get('critical_issues', 0)}")
    print(f"📋 Total Issues: {quality_metrics.get('total_issues', 0)}")
    print(f"⏱️ Execution Time: {summary.get('execution_time', 0):.2f}s")
    print(f"📊 Dashboard: tests/docs-qa/results/quality_dashboard.html")
    
    # Generate CI report if requested
    if args.ci:
        ci_report = dashboard.generate_ci_report(qa_results)
        ci_report_path = dashboard.results_dir / "ci_report.md"
        with open(ci_report_path, 'w') as f:
            f.write(ci_report)
        print(f"📄 CI Report: {ci_report_path}")
    
    # Exit with error code if quality gates failed
    if summary.get('overall_status') != 'PASS':
        print(f"\n❌ Quality gates failed! Please review and fix issues.")
        exit(1)
    else:
        print(f"\n✅ All quality gates passed!")
        exit(0)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())