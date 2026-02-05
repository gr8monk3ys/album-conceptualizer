# Prometheus Monitoring

This folder contains a minimal Prometheus scrape config and example alert rules.

- `prometheus.yml` scrapes the API metrics endpoint in Prometheus text format.
- `alerts.yml` includes sample alerts for errors and no traffic.

Update the `targets` in `prometheus.yml` to match your deployment.
