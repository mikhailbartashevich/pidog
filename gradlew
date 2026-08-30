#!/bin/sh

APP_HOME=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P) || exit 1
JAVA_CMD=${JAVA_HOME:+$JAVA_HOME/bin/}java

if ! command -v "$JAVA_CMD" >/dev/null 2>&1; then
    echo "Java 17 is required. Set JAVA_HOME or install Android Studio." >&2
    exit 1
fi

exec "$JAVA_CMD" -Xmx64m -Xms64m \
    -classpath "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" \
    org.gradle.wrapper.GradleWrapperMain "$@"
