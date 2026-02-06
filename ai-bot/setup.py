from setuptools import setup, find_packages

setup(
    name="dukansathi-ai",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "langchain-google-vertexai",
        "langchain-core",
        "langgraph",
        "google-auth",
        "google-cloud-aiplatform",
        "supabase",
        "python-dotenv",
        "pydantic"
    ],
)
