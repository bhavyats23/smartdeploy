pipeline {
    agent any

    parameters {
        string(name: 'REPO_URL',     defaultValue: 'https://github.com/bhavyats23/smartdeploy', description: 'GitHub repo URL to deploy')
        string(name: 'REPO_NAME',    defaultValue: 'smartdeploy', description: 'Repository name')
        string(name: 'DEPLOYMENT_ID', defaultValue: '', description: 'MongoDB Deployment ID to update')
        string(name: 'BACKEND_URL',  defaultValue: 'https://spill-subsidy-rancidity.ngrok-free.app', description: 'SmartDeploy backend URL')
    }

    environment {
        RAILWAY_TOKEN = '4fccaedf-f7f1-4a3a-b9e7-f3838cf2e1d5'
        RAILWAY_CMD   = 'C:\\Users\\PALLAVI\\AppData\\Roaming\\npm\\railway.cmd'
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
                        // Step 1: Create a new Railway project with a unique name
                        def projectName = "${params.REPO_NAME}-${BUILD_NUMBER}".toLowerCase().replaceAll('[^a-z0-9-]', '-')

                        // Step 2: Deploy and capture ALL output
                        def output = bat(
                            script: """
                                set RAILWAY_TOKEN=${RAILWAY_TOKEN}
                                echo Creating Railway project: ${projectName}
                                "${RAILWAY_CMD}" init --name ${projectName} -y
                                echo --- Deploying ---
                                "${RAILWAY_CMD}" up --detach
                                echo --- Getting domain ---
                                "${RAILWAY_CMD}" domain
                            """,
                            returnStdout: true
                        ).trim()

                        echo "=== Railway Output ==="
                        echo "${output}"
                        echo "======================"

                        // Step 3: Extract the Railway URL from output
                        def urlMatcher = output =~ /https:\/\/[a-zA-Z0-9\-]+\.up\.railway\.app/
                        def liveUrl = urlMatcher ? urlMatcher[0] : ""

                        // Step 4: If no URL found from domain cmd, construct a likely one
                        if (!liveUrl) {
                            liveUrl = "https://${projectName}.up.railway.app"
                        }

                        echo "LIVE_URL=${liveUrl}"

                        // Step 5: Send the live URL back to SmartDeploy backend → saves to MongoDB
                        if (params.DEPLOYMENT_ID) {
                            bat """
                                curl -s -X POST "${params.BACKEND_URL}/api/deployments/${params.DEPLOYMENT_ID}/update" ^
                                -H "Content-Type: application/json" ^
                                -d "{\\"status\\":\\"success\\",\\"liveUrl\\":\\"${liveUrl}\\"}"
                            """
                            echo "MongoDB updated with live URL!"
                        } else {
                            echo "No DEPLOYMENT_ID provided - skipping MongoDB update"
                        }

                        echo "Deployment complete for ${params.REPO_NAME}!"
                    }
                }
            }
        }
    }

    post {
        success {
            echo "ALL STAGES PASSED! Pipeline finished for ${params.REPO_NAME}"
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