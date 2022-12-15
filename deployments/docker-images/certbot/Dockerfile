FROM certbot/certbot

# attempt to renew certificates every day
RUN echo "0 0 * * * certbot renew" | crontab -

ENTRYPOINT [ "/bin/sh", "-c" ]