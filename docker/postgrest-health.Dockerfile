FROM public.ecr.aws/supabase/postgrest:v16.5 AS postgrest

FROM busybox:1.36

COPY --from=postgrest /bin/postgrest /bin/postgrest

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD ["wget", "-qO", "/dev/null", "http://127.0.0.1:3000/"]

USER 1000
ENTRYPOINT ["/bin/postgrest"]
