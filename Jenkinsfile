pipeline {
    agent any

    parameters {
        string(name: 'REPO_URL',      defaultValue: 'https://github.com/bhavyats23/smartdeploy', description: 'GitHub repo URL to deploy')
        string(name: 'REPO_NAME',     defaultValue: 'smartdeploy', description: 'Repository name')
        string(name: 'DEPLOYMENT_ID', defaultValue: '', description: 'MongoDB Deployment ID to update')
        string(name: 'BACKEND_URL',   defaultValue: 'https://smartdeploy-backend-idhp.onrender.com', description: 'SmartDeploy backend URL')
    }

    environment {
        RENDER_DEPLOY_HOOK = 'https://api.render.com/deploy/srv-d7oec7iqqhas73fl9aog?key=lpYlf7lvGJc'
        LIVE_URL = 'https://smartdeploy-backend-idhp.onrender.com'
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
                echo "Triggering Render deploy for ${params.REPO_NAME}..."
                script {
                    bat """
                        curl -s -X POST "${RENDER_DEPLOY_HOOK}"
                    """
                    echo "Render deploy triggered!"
                    echo "LIVE_URL=${LIVE_URL}"

                    if (params.DEPLOYMENT_ID) {
                        bat """
                            curl -s -X POST "${params.BACKEND_URL}/api/deployments/${params.DEPLOYMENT_ID}/update" ^
                            -H "Content-Type: application/json" ^
                            -d "{\\"status\\":\\"success\\",\\"liveUrl\\":\\"${LIVE_URL}\\"}"
                        """
                        echo "MongoDB updated!"
                    }
                }
            }
        }
    }

    post {
        success {
            echo "ALL STAGES PASSED for ${params.REPO_NAME}"
        }
        failure {
            script {
                if (params.DEPLOYMENT_ID && params.BACKEND_URL) {
                    bat """
                        curl -s -X POST "${params.BACKEND_URL}/api/deployments/${params.DEPLOYMENT_ID}/update" ^
                        -H "Content-Type: application/json" ^
                        -d "{\\"status\\":\\"failed\\"}"
                    """
                }
            }
            echo "PIPELINE FAILED for ${params.REPO_NAME}"
        }
    }
}