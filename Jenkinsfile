
pipeline {
    agent any

    triggers {
        pollSCM('H/2 * * * *')
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        IMAGE_NAME = 'anandarcade'
        CONTAINER_NAME = 'anandarcade'
        LEGACY_CONTAINER_NAME = 'mini-arcade'
        HOST_PORT = '8083'
        CANDIDATE_PORT = '18083'
        CONTAINER_PORT = '8082'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Syntax Validation') {
            steps {
                sh 'npm run check'
            }
        }

        stage('Automated Tests') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    set -eu

                    docker build \
                      -t ${IMAGE_NAME}:${BUILD_NUMBER} \
                      -t ${IMAGE_NAME}:latest .
                '''
            }
        }

        stage('Test Candidate Container') {
            steps {
                sh '''
                    set -eu

                    CANDIDATE="${CONTAINER_NAME}-candidate-${BUILD_NUMBER}"

                    cleanup() {
                        docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
                    }

                    trap cleanup EXIT

                    docker run -d \
                      --name "$CANDIDATE" \
                      -p 127.0.0.1:${CANDIDATE_PORT}:${CONTAINER_PORT} \
                      ${IMAGE_NAME}:${BUILD_NUMBER}

                    HEALTHY=0

                    for attempt in $(seq 1 20); do
                        if curl --fail --silent \
                          http://127.0.0.1:${CANDIDATE_PORT}/api/health \
                          > health-response.json; then

                            if grep -q '"status":"ok"' health-response.json; then
                                HEALTHY=1
                                break
                            fi
                        fi

                        sleep 2
                    done

                    if [ "$HEALTHY" -ne 1 ]; then
                        echo "Candidate health check failed."
                        docker logs "$CANDIDATE" || true
                        exit 1
                    fi

                    echo "Candidate health check passed."
                '''
            }
        }

        stage('Deploy Locally') {
            steps {
                sh '''
                    set -eu

                    NEW_CONTAINER="${CONTAINER_NAME}-new-${BUILD_NUMBER}"
                    BACKUP_CONTAINER="${CONTAINER_NAME}-backup-${BUILD_NUMBER}"
                    OLD_NAME=""

                    cleanup_new() {
                        docker rm -f "$NEW_CONTAINER" >/dev/null 2>&1 || true
                    }

                    rollback() {
                        echo "Deployment failed. Attempting rollback."

                        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

                        if [ -n "$OLD_NAME" ] &&
                           docker container inspect "$BACKUP_CONTAINER" >/dev/null 2>&1; then
                            docker rename "$BACKUP_CONTAINER" "$OLD_NAME" || true
                            docker start "$OLD_NAME" || true
                        fi
                    }

                    trap cleanup_new EXIT

                    if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
                        OLD_NAME="$CONTAINER_NAME"
                    elif docker container inspect "$LEGACY_CONTAINER_NAME" >/dev/null 2>&1; then
                        OLD_NAME="$LEGACY_CONTAINER_NAME"
                    fi

                    docker create \
                      --name "$NEW_CONTAINER" \
                      ${IMAGE_NAME}:${BUILD_NUMBER} >/dev/null

                    if [ -n "$OLD_NAME" ]; then
                        docker stop "$OLD_NAME"
                        docker rename "$OLD_NAME" "$BACKUP_CONTAINER"
                    fi

                    if ! docker run -d \
                      --name "$CONTAINER_NAME" \
                      --restart unless-stopped \
                      -p 0.0.0.0:${HOST_PORT}:${CONTAINER_PORT} \
                      ${IMAGE_NAME}:${BUILD_NUMBER}; then
                        rollback
                        exit 1
                    fi

                    HEALTHY=0

                    for attempt in $(seq 1 20); do
                        if curl --fail --silent \
                          http://127.0.0.1:${HOST_PORT}/api/health \
                          > health-response.json; then

                            if grep -q '"status":"ok"' health-response.json; then
                                HEALTHY=1
                                break
                            fi
                        fi

                        sleep 2
                    done

                    if [ "$HEALTHY" -ne 1 ]; then
                        docker logs "$CONTAINER_NAME" || true
                        rollback
                        exit 1
                    fi

                    if [ -n "$OLD_NAME" ]; then
                        docker rm -f "$BACKUP_CONTAINER" >/dev/null
                    fi

                    echo "AnandArcade deployment successful!"
                    curl --fail --silent \
                      http://127.0.0.1:${HOST_PORT}/api/health
                    echo
                '''
            }
        }
    }

    post {
        success {
            echo 'AnandArcade CI/CD pipeline completed successfully!'
        }

        failure {
            echo 'Pipeline failed. Check Console Output for details.'
        }

        always {
            echo 'AnandArcade pipeline execution finished.'
        }
    }
}
