from typing import Any, Dict, List
from app.utils.text_validators import detect_duplicate_keywords, detect_trademark_warnings


class KDPSeoService:
    """Evaluates Amazon KDP metadata compliance without guaranteeing ranking or sales."""

    def audit_metadata(
        self,
        title: str,
        subtitle: str,
        description: str,
        keywords: List[str],
        categories: List[str],
        target_audience: str,
        author_name: str,
    ) -> Dict[str, Any]:
        combined_title_len = len(title) + len(subtitle)
        trademark_hits = detect_trademark_warnings(
            f"{title} {subtitle} {description} {' '.join(keywords)}"
        )
        duplicates = detect_duplicate_keywords(title, subtitle, keywords)
        filled_slots = [kw for kw in keywords[:7] if kw.strip()]
        over_limit_slots = [i + 1 for i, kw in enumerate(keywords[:7]) if len(kw) > 50]

        checks = [
            ("title_valid", bool(title.strip()) and combined_title_len <= 200, 15),
            ("subtitle_present", bool(subtitle.strip()), 10),
            ("author_present", bool(author_name.strip()), 10),
            ("audience_present", bool(target_audience.strip()), 10),
            ("description_valid", 120 <= len(description.strip()) <= 4000, 15),
            ("seven_keywords_filled", len(filled_slots) == 7 and not over_limit_slots, 20),
            ("categories_selected", 1 <= len(categories) <= 3, 10),
            ("no_trademark_risks", len(trademark_hits) == 0, 10),
        ]
        completeness_score = sum(weight for _, ok, weight in checks if ok)

        policy_concerns: List[str] = []
        if combined_title_len > 200:
            policy_concerns.append("Combined title + subtitle exceeds KDP 200-character maximum.")
        if over_limit_slots:
            policy_concerns.append(f"Keyword slot(s) exceed 50-character limit: {over_limit_slots}.")
        if trademark_hits:
            policy_concerns.append(f"Potential trademark or promotional claim risk: {trademark_hits}.")

        return {
            "completeness_score": completeness_score,
            "character_counts": {
                "title": len(title),
                "subtitle": len(subtitle),
                "combined_title_subtitle": combined_title_len,
                "description": len(description),
                "keyword_slot_lengths": [len(kw) for kw in keywords[:7]],
            },
            "duplicate_keywords": duplicates,
            "trademark_warnings": trademark_hits,
            "policy_concerns": policy_concerns,
            "requires_user_review_before_export": True,
            "disclaimer": "SEO checks verify KDP policy alignment and do not guarantee Amazon ranking or sales.",
        }
