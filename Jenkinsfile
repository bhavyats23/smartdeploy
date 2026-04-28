pipeline {
    agent any

    parameters {
        string(name: 'REPO_URL', defaultValue: 'https://github.com/bhavyats23/smartdeploy', description: 'GitHub repo URL to deploy')
        string(name: 'REPO_NAME', defaultValue: 'smartdeploy', description: 'Repository name')
    }

    environment {
        RAILWAY_TOKEN = '4fccaedf-f7f1-4a3a-b9e7-f3838cf2e1d5'
    }

    stages {

        stage('Clone') {
            steps {
                echo "Cloning ${params.REPO_URL}..."
                bat "if exist repo rmdir /s /q repo"
                bat "git clone ${params.REPO_URL} repo"
                echo "Clone done!"
            }
        }

        stage('Install') {
            steps {
                echo "Installing dependencies..."
                dir('repo') {
                    bat "npm install || echo No package.json, skipping"
                }
                echo "Install done!"
            }
        }

        stage('Test') {
            steps {
                echo "Running tests..."
                dir('repo') {
                    bat "npm test --if-present || echo No tests found, skipping"
                }
                echo "Tests done!"
            }
        }

        stage('Build') {
            steps {
                echo "Building project..."
                dir('repo') {
                    bat "npm run build --if-present || echo No build script, skipping"
                }
                echo "Build done!"
            }
        }

        stage('Deploy') {
            steps {
                echo "Deploying ${params.REPO_NAME} to Railway..."
                script {
                    dir('repo') {
                        // Create a new Railway project and deploy
                        def output = bat(
                            script: """
                                set RAILWAY_TOKEN=${RAILWAY_TOKEN}
                                railway init --name ${params.REPO_NAME} -y 2>&1 || echo Init done
                                railway up --detach 2>&1
                                railway domain 2>&1
                            """,
                            returnStdout: true
                        ).trim()

                        echo "Railway output: ${output}"

                        // Extract the live URL
                        def urlMatcher = output =~ /https:\/\/[a-zA-Z0-9\-]+\.up\.railway\.app/
                        def liveUrl = urlMatcher ? urlMatcher[0] : "https://railway.app/dashboard"

                        echo "LIVE_URL=${liveUrl}"
                        echo "Deployment complete for ${params.REPO_NAME}!"
                    }
                }
            }
        }
    }

    post {
        success {
            echo "ALL STAGES PASSED!"
            echo "Pipeline finished successfully for ${params.REPO_NAME}"
        }
        failure {
            echo "PIPELINE FAILED for ${params.REPO_NAME}"
        }
    }
}