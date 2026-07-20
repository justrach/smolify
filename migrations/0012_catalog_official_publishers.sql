-- Extend official-source provenance for the curated public catalog. Numeric
-- GitHub owner IDs survive account renames and prevent lookalike owners from
-- inheriting the badge. This is source provenance, not a security endorsement.
INSERT OR IGNORE INTO github_official_publishers
  (github_owner_id, login, display_name, website_url, github_url, verified_at)
VALUES
  (25158, 'php', 'PHP', 'https://www.php.net', 'https://github.com/php', '2026-07-20T00:00:00.000Z'),
  (6154722, 'microsoft', 'Microsoft', 'https://opensource.microsoft.com', 'https://github.com/microsoft', '2026-07-20T00:00:00.000Z'),
  (25720743, 'huggingface', 'Hugging Face', 'https://huggingface.co', 'https://github.com/huggingface', '2026-07-20T00:00:00.000Z'),
  (97503431, 'opendatalab', 'OpenDataLab', 'https://opendatalab.org.cn', 'https://github.com/opendatalab', '2026-07-20T00:00:00.000Z'),
  (241138, 'karpathy', 'Andrej Karpathy', 'https://github.com/karpathy', 'https://github.com/karpathy', '2026-07-20T00:00:00.000Z'),
  (319983, 'celery', 'Celery', 'https://docs.celeryq.dev', 'https://github.com/celery', '2026-07-20T00:00:00.000Z'),
  (18461506, 'Tencent', 'Tencent', 'https://opensource.tencent.com', 'https://github.com/Tencent', '2026-07-20T00:00:00.000Z'),
  (140580304, 'eosphoros-ai', 'DB-GPT', 'https://dbgpt.cn', 'https://github.com/eosphoros-ai', '2026-07-20T00:00:00.000Z'),
  (32978552, 'linshenkx', 'Lin Shen', 'https://linshenkx.github.io', 'https://github.com/linshenkx', '2026-07-20T00:00:00.000Z'),
  (28928681, 'nextapps-de', 'Nextapps GmbH', 'https://nextapps.de', 'https://github.com/nextapps-de', '2026-07-20T00:00:00.000Z'),
  (216033749, 'agent0ai', 'Agent Zero', 'https://agent-zero.ai', 'https://github.com/agent0ai', '2026-07-20T00:00:00.000Z'),
  (102812, 'react', 'React', 'https://react.dev', 'https://github.com/react', '2026-07-20T00:00:00.000Z');

UPDATE projects
SET source_owner_github_id = 25158,
    source_owner_login = 'php',
    source_owner_type = 'Organization'
WHERE lower(source_url) LIKE 'https://github.com/php/%';
