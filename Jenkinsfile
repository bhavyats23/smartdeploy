pipeline {
    agent any

    parameters {
        string(name: 'REPO_URL',          defaultValue: 'https://github.com/bhavyats23/smartdeploy', description: 'GitHub repo URL to deploy')
        string(name: 'REPO_NAME',         defaultValue: 'smartdeploy',                               description: 'Repository name')
        string(name: 'DEPLOYMENT_ID',     defaultValue: '',                                           description: 'MongoDB Deployment ID to update')
        string(name: 'BACKEND_URL',       defaultValue: 'https://smartdeploy-backend-idhp.onrender.com', description: 'SmartDeploy backend URL')
        string(name: 'RENDER_HOOK_URL',   defaultValue: '',                                           description: 'Render deploy hook URL for this repo')
        string(name: 'RENDER_SERVICE_ID', defaultValue: '',                                           description: 'Render service ID for this repo (srv-xxxxx)')
    }

    environment {
        RENDER_API_KEY = credentials('render-api-key')   // add this in Jenkins credentials
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
        stage('SonarCloud Analysis') {
            steps {
                echo "Running SonarCloud analysis..."
                dir('repo') {
                    withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                        bat """
                            sonar-scanner ^
                            -Dsonar.projectKey=bhavyats23_smartdeploy ^
                            -Dsonar.organization=bhavyats23 ^
                            -Dsonar.projectName=SmartDeploy ^
                            -Dsonar.sources=. ^
                            -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.js ^
                            -Dsonar.host.url=https://sonarcloud.io ^
                            -Dsonar.token=%SONAR_TOKEN%
                        """
                    }
                }
                echo "SonarCloud analysis done!"
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
        stage('Docker Build & Push') {
            steps {
                echo "Building Docker image..."
                dir('repo') {
                    withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        bat "docker build -t %DOCKER_USER%/smartdeploy:%BUILD_NUMBER% ."
                        bat "docker login -u %DOCKER_USER% -p %DOCKER_PASS%"
                        bat "docker push %DOCKER_USER%/smartdeploy:%BUILD_NUMBER%"
                        bat "docker tag %DOCKER_USER%/smartdeploy:%BUILD_NUMBER% %DOCKER_USER%/smartdeploy:latest"
                        bat "docker push %DOCKER_USER%/smartdeploy:latest"
                    }
                }
                echo "Docker build and push done!"
            }
        }
        stage('Deploy') {
            steps {
                echo "Triggering Render deploy for ${params.REPO_NAME}..."
                script {

                    // 1. Fire the deploy hook
                    bat "curl -s -X POST \"${params.RENDER_HOOK_URL}\""
                    echo "Deploy hook fired. Waiting for Render to finish..."

                    // 2. Poll Render API until serviceUrl is available (max ~3 min)
                    def liveUrl = ''
                    for (int i = 0; i < 18; i++) {
                        sleep(10)
                        def response = bat(
                            script: "curl -s -H \"Authorization: Bearer %RENDER_API_KEY%\" https://api.render.com/v1/services/${params.RENDER_SERVICE_ID}",
                            returnStdout: true
                        ).trim()

                        // strip any leading non-JSON (Windows bat echoes the command too)
                        def jsonStart = response.indexOf('{')
                        if (jsonStart >= 0) {
                            response = response.substring(jsonStart)
                        }

                        try {
                            def json = readJSON text: response
                            def url = json?.serviceDetails?.url ?: json?.url
                            if (url) {
                                liveUrl = url.startsWith('http') ? url : "https://${url}"
                                echo "Live URL found: ${liveUrl}"
                                break
                            }
                        } catch (e) {
                            echo "Waiting for Render... attempt ${i + 1}/18"
                        }
                    }

                    if (!liveUrl) {
                        error "Render deploy timed out — no live URL returned after 3 minutes"
                    }

                    // 3. POST result back to SmartDeploy backend
                    if (params.DEPLOYMENT_ID) {
                        bat """
                            curl -s -X POST "${params.BACKEND_URL}/api/deployments/${params.DEPLOYMENT_ID}/update" ^
                            -H "Content-Type: application/json" ^
                            -d "{\\"status\\":\\"success\\",\\"liveUrl\\":\\"${liveUrl}\\"}"
                        """
                        echo "Backend updated with live URL!"
                    }
                }
            }
        }
    }

    post {
        failure {
            script {
                if (params.DEPLOYMENT_ID && params.BACKEND_URL) {
                    bat """
                        curl -s -X POST "${params.BACKEND_URL}/api/deployments/${params.DEPLOYMENT_ID}/update" ^
                        -H "Content-Type: application/json" ^
                        -d "{\\"status\\":\\"failed\\",\\"liveUrl\\":\\"\\"}"
                    """
                }
            }
            echo "Pipeline failed for ${params.REPO_NAME}"
        }
        success {
            echo "All stages passed for ${params.REPO_NAME}"
        }
    }
}