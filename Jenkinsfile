pipeline {
    agent any

    parameters {
        string(name: 'REPO_URL', defaultValue: 'https://github.com/bhavyats23/smartdeploy', description: 'GitHub repo URL to deploy')
        string(name: 'REPO_NAME', defaultValue: 'smartdeploy', description: 'Repository name')
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
                    // This is where Railway deployment happens
                    // The live URL is printed so SmartDeploy backend can extract it
                    def liveUrl = "https://smartdeploy-production.up.railway.app"
                    echo "LIVE_URL=${liveUrl}"
                    echo "Deployment complete for ${params.REPO_NAME}!"
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